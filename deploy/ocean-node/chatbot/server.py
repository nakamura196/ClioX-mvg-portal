"""Chatbot server for the Clio-X Sepolia trial (/usecases/chatbot).

Why this exists: the portal's chatbot page talks to a separate service through
CHATBOT_API_URL. Upstream's public backend (ciferresearch/Cliox-rag-chatbot-
backend, last commit 2025-07-17) no longer matches what the portal calls: it has
no DELETE /knowledge/session and answers /chat with one JSON body, while the
page reads a stream of server-sent events. The service upstream runs is not
public. This file implements the same HTTP contract as the portal uses it
(src/pages/api/chatbot/*.ts, src/@utils/chatbot/index.ts), nothing more.

  GET    /api/health                         {status, ollama_connected, model}
  POST   /api/v1/session/knowledge/upload    {session_id, knowledge_chunks, domains}
  GET    /api/v1/session/knowledge/status    header X-Session-ID
  DELETE /api/v1/session/knowledge/session   header X-Session-ID
  POST   /api/v1/session/chat                {session_id, message, config}
         Accept: text/event-stream → events {type: status|chunk|complete|error}
         otherwise                  → {success, response, sources, metadata}

How it answers: the passages uploaded for a session are searched with BM25
(words; Japanese by character pairs), the best few go into the prompt, and a
model writes the answer from them. BACKEND picks the model:
  ollama     (default) a local model served by Ollama; standard library only
  anthropic  Claude through the Anthropic API; needs ANTHROPIC_API_KEY and the
             `anthropic` package (the Dockerfile next to this file installs it)
  openai     any OpenAI-compatible API; needs OPENAI_API_KEY. OPENAI_BASE_URL
             defaults to mdx-MaaS (https://api.maas.mdx1.jp/v1), and MODEL to
             gemma-4 there (fast, keeps to the passages; tried 2026-10-08)
Knowledge lives in memory only and is dropped after SESSION_TTL seconds
without use.

Every request except /api/health must carry X-Chatbot-Key = API_KEY; the
portal's API routes add it from their own CHATBOT_API_KEY.

Who may ask, and how much (all optional; off when unset). The portal sends the
wallet address it verified by signature as X-Chatbot-User (only when its
CHATBOT_REQUIRE_SIGNIN is on). Only questions that reach the model count.
  ALLOWED_USERS          addresses allowed to ask (JSON array or commas)
  DAILY_LIMIT_PER_USER   questions per address per day (UTC)
  DAILY_LIMIT_TOTAL      questions per day for everyone together: the real
                         cost ceiling, since new addresses are free to make
  USAGE_FILE             where today's counts are kept across restarts
If ALLOWED_USERS or DAILY_LIMIT_PER_USER is set, a question without
X-Chatbot-User is refused. DAILY_LIMIT_TOTAL alone works without sign-in.

Standard library only when BACKEND=ollama or openai.
"""
import hmac
import json
import math
import os
import re
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8001"))
BACKEND = os.environ.get("BACKEND", "ollama")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
DEFAULT_MODELS = {
    "anthropic": "claude-opus-5-5",
    "openai": "google/gemma-4-31B-it-qat-w4a16-ct",
    "ollama": "qwen2.5:1.5b",
}
MODEL = os.environ.get("MODEL") or DEFAULT_MODELS.get(BACKEND, "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.maas.mdx1.jp/v1").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
# Claude only: how hard it thinks before answering. Answers here are short and
# drawn from four passages, so "low" is enough (compared 2026-09-30).
EFFORT = os.environ.get("EFFORT", "low")
API_KEY = os.environ.get("API_KEY", "")
SESSION_TTL = int(os.environ.get("SESSION_TTL", "7200"))
MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS", "200"))
MAX_CHUNKS = int(os.environ.get("MAX_CHUNKS_PER_SESSION", "5000"))
MAX_BODY = int(os.environ.get("MAX_BODY_BYTES", str(20 * 1024 * 1024)))
TOP_K = int(os.environ.get("TOP_K", "4"))
# Ollama counts only the answer. Claude's limit also covers its thinking,
# so it needs more room for the same length of answer.
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", {"anthropic": "4000", "openai": "1500"}.get(BACKEND, "512")))

def address_list(raw):
    raw = raw.strip()
    items = json.loads(raw) if raw.startswith("[") else raw.split(",")
    return {a.strip().lower() for a in items if a.strip()}


ALLOWED_USERS = address_list(os.environ.get("ALLOWED_USERS", ""))
LIMIT_USER = int(os.environ.get("DAILY_LIMIT_PER_USER") or 0)
LIMIT_TOTAL = int(os.environ.get("DAILY_LIMIT_TOTAL") or 0)
USAGE_FILE = os.environ.get("USAGE_FILE", "")
NEED_USER = bool(ALLOWED_USERS or LIMIT_USER)
# Ollama answers one request at a time on CPU; more would only queue. With
# Claude this also caps what a burst of questions can cost at once.
GENERATIONS = threading.BoundedSemaphore(int(os.environ.get("MAX_PARALLEL", "2")))

SYSTEM_PROMPT = (
    "You answer questions about archival documents. Use only the numbered "
    "passages given to you. If they do not contain the answer, say that the "
    "documents provided do not say. Mention the title of the passage you used; "
    "do not refer to passages by their numbers, which the reader cannot see. "
    "Answer in the language of the question, briefly."
)

TOKEN = re.compile(r"[a-z0-9]+|[぀-ヿ一-鿿々]+")
STOP = set(
    "the of and to in a is that be for as by it with on are was this which or "
    "from at an not what who when where how why does did do".split()
)


def tokens(text: str):
    out = []
    for t in TOKEN.findall(text.lower()):
        if t.isascii():
            if t not in STOP and len(t) > 1:
                # fold simple plurals so "factions" finds "faction"
                out.append(t[:-1] if len(t) > 4 and t.endswith("s") and not t.endswith("ss") else t)
        else:  # Japanese: character pairs
            out.extend(t[i : i + 2] for i in range(max(1, len(t) - 1)))
    return out


class Session:
    def __init__(self):
        self.chunks = []  # {id, content, metadata, tf, length}
        self.ids = set()
        self.domains = set()
        self.df = Counter()
        self.last_used = time.time()

    def add(self, chunk, domains):
        cid = str(chunk.get("id") or len(self.chunks))
        content = chunk.get("content")
        if cid in self.ids or not isinstance(content, str) or not content.strip():
            return False
        toks = tokens(content)
        tf = Counter(toks)
        self.chunks.append(
            {
                "id": cid,
                "content": content,
                "metadata": chunk.get("metadata") or {},
                "tf": tf,
                "length": len(toks) or 1,
            }
        )
        self.ids.add(cid)
        self.df.update(tf.keys())
        self.domains.update(d for d in domains if isinstance(d, str))
        return True

    def search(self, query, k):
        q = tokens(query)
        if not q or not self.chunks:
            return []
        n = len(self.chunks)
        avg = sum(c["length"] for c in self.chunks) / n
        scored = []
        for c in self.chunks:
            s = 0.0
            for t in q:
                f = c["tf"].get(t, 0)
                if f:
                    idf = math.log(1 + (n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                    s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * c["length"] / avg))
            if s > 0:
                scored.append((s, c))
        scored.sort(key=lambda x: -x[0])
        return scored[:k]


SESSIONS = {}
LOCK = threading.Lock()


class Usage:
    """Questions asked today, per address and in total. Reset at 00:00 UTC."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.day, self.total, self.users = "", 0, {}
        try:
            with open(path) as f:
                d = json.load(f)
            self.day, self.total, self.users = d["day"], d["total"], d["users"]
        except (OSError, ValueError, KeyError, TypeError):
            pass

    def take(self, user):
        """Count one question for user, or return why it is refused."""
        with self.lock:
            today = time.strftime("%Y-%m-%d", time.gmtime())
            if self.day != today:
                self.day, self.total, self.users = today, 0, {}
            if LIMIT_TOTAL and self.total >= LIMIT_TOTAL:
                return "total"
            if LIMIT_USER and self.users.get(user, 0) >= LIMIT_USER:
                return "user"
            self.total += 1
            self.users[user] = self.users.get(user, 0) + 1
            if self.path:
                tmp = self.path + ".tmp"
                with open(tmp, "w") as f:
                    json.dump({"day": self.day, "total": self.total, "users": self.users}, f)
                os.replace(tmp, self.path)
            return None


USAGE = Usage(USAGE_FILE)

NOTICES = {
    "signin": ("質問するには、ウォレットでサインインしてください（署名だけで、手数料はかかりません）。",
               "Please sign in with your wallet to ask questions (a signature only; no fee)."),
    "not_allowed": ("このアドレスは、まだ質問できる一覧に入っていません。管理者に連絡してください。",
                    "This address is not on the list of addresses that may ask questions yet. "
                    "Please contact the administrator."),
    "user": (f"今日の質問は上限（{LIMIT_USER} 件）に達しました。0 時（UTC）に戻ります。",
             f"You have reached today's limit ({LIMIT_USER} questions). It resets at 00:00 UTC."),
    "total": ("このサイト全体の今日の質問が上限に達しました。0 時（UTC）に戻ります。",
              "The site has reached today's limit on questions. It resets at 00:00 UTC."),
}


def notice(key, question):
    ja, en = NOTICES[key]
    return ja if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", question) else en


def session(sid, create=False):
    with LOCK:
        now = time.time()
        for key in [k for k, v in SESSIONS.items() if now - v.last_used > SESSION_TTL]:
            del SESSIONS[key]
        s = SESSIONS.get(sid)
        if s is None and create:
            if len(SESSIONS) >= MAX_SESSIONS:
                oldest = min(SESSIONS, key=lambda k: SESSIONS[k].last_used)
                del SESSIONS[oldest]
            s = SESSIONS[sid] = Session()
        if s:
            s.last_used = now
        return s


def source_label(chunk):
    m = chunk["metadata"]
    return str(m.get("title") or m.get("source") or chunk["id"])


def build_messages(question, hits):
    passages = "\n\n".join(
        f"[{i}] {source_label(c)}\n{c['content'][:2000]}" for i, (_, c) in enumerate(hits, 1)
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Passages:\n\n{passages}\n\nQuestion: {question}"},
    ]


def ollama_chat(messages, config):
    """Yield pieces of the answer as Ollama produces them."""
    body = {
        "model": MODEL,
        "messages": messages,
        "stream": True,
        "keep_alive": "30m",
        "options": {
            "temperature": float(config.get("temperature") or 0.3),
            "num_predict": min(int(config.get("max_tokens") or MAX_TOKENS), MAX_TOKENS),
        },
    }
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as res:
        for line in res:
            if not line.strip():
                continue
            data = json.loads(line)
            if data.get("error"):
                raise RuntimeError(data["error"])
            piece = data.get("message", {}).get("content", "")
            if piece:
                yield piece
            if data.get("done"):
                return


CLIENT = None  # Anthropic client, made at start when BACKEND=anthropic


def claude_chat(messages, config):
    """Yield pieces of the answer as Claude writes them.

    Errors become RuntimeError with a short reason, which chat() reports to
    the page like an Ollama error."""
    import anthropic

    try:
        with CLIENT.beta.messages.stream(
            model=MODEL,
            # Not the page's max_tokens: it asks for 500, which with Claude
            # would also have to hold the thinking and cut answers short.
            max_tokens=MAX_TOKENS,
            system=messages[0]["content"],
            messages=messages[1:],
            output_config={"effort": EFFORT},
            # If Claude's safety check declines a question, the API retries it
            # on another model in the same call instead of stopping.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        ) as stream:
            yield from stream.text_stream
            final = stream.get_final_message()
    except anthropic.RateLimitError:
        raise RuntimeError("rate limited by the Anthropic API, try again in a moment")
    except anthropic.APIStatusError as e:
        raise RuntimeError(f"Anthropic API returned {e.status_code}")
    except anthropic.APIConnectionError:
        raise RuntimeError("could not reach the Anthropic API")
    u = final.usage
    print(f"claude: in {u.input_tokens} out {u.output_tokens} stop {final.stop_reason}", flush=True)
    if final.stop_reason == "refusal":
        yield "\n\n(The model declined to answer this question.)"


def openai_chat(messages, config):
    """Yield pieces of the answer from an OpenAI-compatible API (mdx-MaaS).

    Thinking models send their reasoning in a separate field; only the
    answer (delta.content) is passed on."""
    body = {
        "model": MODEL,
        "messages": messages,
        "stream": True,
        "temperature": float(config.get("temperature") or 0.3),
        # As with Claude, not the page's max_tokens: a thinking model spends
        # part of it before the answer starts.
        "max_tokens": MAX_TOKENS,
    }
    req = urllib.request.Request(
        f"{OPENAI_BASE_URL}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"},
    )
    started = False
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            for line in res:
                line = line.decode().strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    return
                d = json.loads(data)
                if d.get("error"):
                    raise RuntimeError(str(d["error"].get("message") or d["error"]))
                for choice in d.get("choices") or []:
                    piece = (choice.get("delta") or {}).get("content") or ""
                    if not started:
                        # Some models (Qwen3.6) open with blank lines.
                        piece = piece.lstrip()
                        started = bool(piece)
                    if piece:
                        yield piece
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"model API returned {e.code}")
    except urllib.error.URLError:
        raise RuntimeError("could not reach the model API")


def generate(messages, config):
    if BACKEND == "anthropic":
        return claude_chat(messages, config)
    if BACKEND == "openai":
        return openai_chat(messages, config)
    return ollama_chat(messages, config)


def ollama_connected():
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=3) as res:
            names = [m.get("name") for m in json.load(res).get("models", [])]
        return MODEL in names
    except (urllib.error.URLError, OSError, ValueError):
        return False


class Handler(BaseHTTPRequestHandler):
    # One request per connection. Keeping connections open gains nothing
    # behind the tunnel, and a request whose body was not read in full would
    # otherwise be misread as the next request (seen 2026-09-27).
    protocol_version = "HTTP/1.0"
    server_version = "cliox-trial-chatbot"

    def log_message(self, fmt, *args):  # no request bodies or session ids in logs
        print(f"{self.command} {self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}", flush=True)

    def send_json(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorised(self):
        given = self.headers.get("X-Chatbot-Key", "")
        if API_KEY and hmac.compare_digest(given, API_KEY):
            return True
        # Say which case it was, never the value.
        print(f"401: key {'missing' if not given else f'wrong (length {len(given)})'}", flush=True)
        self.send_json(401, {"error": "unauthorised"})
        return False

    def read_body(self):
        """Read the whole body, also when it is sent in chunks (the portal's
        server functions on Vercel send large uploads that way). Always called
        before answering, so no unread bytes are left on the connection."""
        if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
            parts, total = [], 0
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    self.rfile.readline()  # blank line after the last chunk
                    break
                total += size
                if total > MAX_BODY:
                    raise ValueError("request too large")
                parts.append(self.rfile.read(size))
                self.rfile.readline()  # CRLF after each chunk
            return b"".join(parts)
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("request too large")
        return self.rfile.read(length)

    def read_json(self):
        return json.loads(self.body or b"{}")

    def session_id(self, body=None):
        sid = (body or {}).get("session_id") or self.headers.get("X-Session-ID") or ""
        return sid if 0 < len(sid) <= 200 else None

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            # For Claude, only whether a key is set: a real check would be a
            # billed request on every health probe. (Field name kept for the
            # portal's health route.)
            if BACKEND == "anthropic":
                ok = bool(CLIENT)
            elif BACKEND == "openai":
                ok = bool(OPENAI_API_KEY)
            else:
                ok = ollama_connected()
            return self.send_json(200, {"status": "healthy" if ok else "degraded",
                                        "ollama_connected": ok, "backend": BACKEND,
                                        "model": MODEL})
        if not self.authorised():
            return
        if path == "/api/v1/session/knowledge/status":
            sid = self.session_id()
            if not sid:
                return self.send_json(400, {"error": "X-Session-ID is required"})
            s = session(sid)
            return self.send_json(200, {
                "has_knowledge": bool(s and s.chunks),
                "chunk_count": len(s.chunks) if s else 0,
                "domains": sorted(s.domains) if s else [],
                "session_id": sid,
            })
        self.send_json(404, {"error": "not found"})

    def do_DELETE(self):
        if not self.authorised():
            return
        if self.path.split("?")[0] != "/api/v1/session/knowledge/session":
            return self.send_json(404, {"error": "not found"})
        sid = self.session_id()
        if not sid:
            return self.send_json(400, {"error": "X-Session-ID is required"})
        with LOCK:
            SESSIONS.pop(sid, None)
        self.send_json(200, {"success": True, "session_id": sid, "message": "Session deleted"})

    def do_POST(self):
        try:
            self.body = self.read_body()
        except ValueError as e:
            return self.send_json(413, {"error": str(e)})
        if not self.authorised():
            return
        path = self.path.split("?")[0]
        try:
            body = self.read_json()
        except (ValueError, json.JSONDecodeError) as e:
            return self.send_json(400, {"error": str(e)})
        sid = self.session_id(body)
        if not sid:
            return self.send_json(400, {"error": "session_id is required"})
        if path == "/api/v1/session/knowledge/upload":
            return self.upload(sid, body)
        if path == "/api/v1/session/chat":
            return self.chat(sid, body)
        self.send_json(404, {"error": "not found"})

    def upload(self, sid, body):
        chunks = body.get("knowledge_chunks")
        if not isinstance(chunks, list):
            return self.send_json(400, {"error": "knowledge_chunks must be a list"})
        s = session(sid, create=True)
        room = max(0, MAX_CHUNKS - len(s.chunks))
        domains = body.get("domains") or []
        added = sum(1 for c in chunks[:room] if isinstance(c, dict) and s.add(c, domains))
        self.send_json(200, {
            "success": True,
            "session_id": sid,
            "chunks_processed": added,
            "domains": sorted(s.domains),
            "message": None if len(chunks) <= room else f"only {room} of {len(chunks)} kept (limit {MAX_CHUNKS})",
        })

    def refusal(self, message):
        """Why this question may not reach the model, as text for the page;
        None when it may (and then it is counted)."""
        if not (NEED_USER or LIMIT_TOTAL):
            return None
        user = self.headers.get("X-Chatbot-User", "").strip().lower()
        if not re.fullmatch(r"0x[0-9a-f]{40}", user):
            if NEED_USER:
                return notice("signin", message)
            user = "anonymous"  # only the total limit applies
        if ALLOWED_USERS and user not in ALLOWED_USERS:
            return notice("not_allowed", message)
        why = USAGE.take(user)
        if why:
            print(f"limit: {why}", flush=True)
            return notice(why, message)
        return None

    def chat(self, sid, body):
        message = body.get("message")
        if not isinstance(message, str) or not message.strip():
            return self.send_json(400, {"error": "message is required"})
        config = body.get("config") or {}
        started = time.time()
        s = session(sid)
        hits = s.search(message, TOP_K) if s else []
        sources = [
            {"source": source_label(c), "relevance_score": round(score, 3),
             "content_preview": c["content"][:200]}
            for score, c in hits
        ]
        stream = "text/event-stream" in self.headers.get("Accept", "")

        if not GENERATIONS.acquire(blocking=False):
            return self.send_json(503, {"error": "busy, try again in a moment"})
        try:
            if not hits:
                # Search is by words, so a Japanese question finds nothing in
                # English documents (and the other way round).
                japanese = re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", message)
                pieces = iter([
                    "読み込んだ資料には、この質問の語が見つかりませんでした。"
                    "資料と同じ言語で、別の言葉で聞いてみてください。"
                    if japanese else
                    "The documents loaded for this chat do not mention that. "
                    "Try other words, in the language of the documents."
                ])
            else:
                refused = self.refusal(message)
                if refused:
                    pieces, hits, sources = iter([refused]), [], []
                else:
                    pieces = generate(build_messages(message, hits), config)

            def metadata():
                return {"chunks_retrieved": len(hits),
                        "processing_time_ms": int((time.time() - started) * 1000),
                        "model_used": MODEL}

            if not stream:
                answer = "".join(pieces)
                return self.send_json(200, {"success": True, "response": answer,
                                            "sources": sources, "metadata": metadata()})

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            def event(obj):
                self.wfile.write(f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode())
                self.wfile.flush()

            event({"type": "status", "status": "generating"})
            try:
                for piece in pieces:
                    event({"type": "chunk", "content": piece})
                event({"type": "complete", "sources": sources, "metadata": metadata()})
            except (urllib.error.URLError, RuntimeError, OSError) as e:
                event({"type": "error", "message": f"model error: {e}"})
        except (urllib.error.URLError, RuntimeError, OSError) as e:
            self.send_json(502, {"error": f"model error: {e}"})
        finally:
            GENERATIONS.release()


if __name__ == "__main__":
    if not API_KEY:
        raise SystemExit("API_KEY is not set; refusing to start an open endpoint")
    if BACKEND == "anthropic":
        import anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit("BACKEND=anthropic needs ANTHROPIC_API_KEY")
        CLIENT = anthropic.Anthropic(timeout=120.0)
        print(f"listening on :{PORT}, model {MODEL} (Anthropic API, effort {EFFORT})", flush=True)
    elif BACKEND == "openai":
        if not OPENAI_API_KEY:
            raise SystemExit("BACKEND=openai needs OPENAI_API_KEY")
        print(f"listening on :{PORT}, model {MODEL} at {OPENAI_BASE_URL}", flush=True)
    elif BACKEND == "ollama":
        print(f"listening on :{PORT}, model {MODEL} at {OLLAMA_URL}", flush=True)
    else:
        raise SystemExit(f"unknown BACKEND {BACKEND!r}; use ollama, anthropic or openai")
    if NEED_USER or LIMIT_TOTAL:
        print(f"questions need a signed-in address: {'yes' if NEED_USER else 'no'}; "
              f"allowed: {len(ALLOWED_USERS) or 'any'}; "
              f"per day: {LIMIT_USER or '-'} per address, {LIMIT_TOTAL or '-'} in total; "
              f"counts kept in {USAGE_FILE or 'memory'}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
