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
local model served by Ollama writes the answer from them. Knowledge lives in
memory only and is dropped after SESSION_TTL seconds without use.

Every request except /api/health must carry X-Chatbot-Key = API_KEY; the
portal's API routes add it from their own CHATBOT_API_KEY.

Standard library only.
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
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
MODEL = os.environ.get("MODEL", "qwen2.5:1.5b")
API_KEY = os.environ.get("API_KEY", "")
SESSION_TTL = int(os.environ.get("SESSION_TTL", "7200"))
MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS", "200"))
MAX_CHUNKS = int(os.environ.get("MAX_CHUNKS_PER_SESSION", "5000"))
MAX_BODY = int(os.environ.get("MAX_BODY_BYTES", str(20 * 1024 * 1024)))
TOP_K = int(os.environ.get("TOP_K", "4"))
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "512"))
# Ollama answers one request at a time on CPU; more would only queue.
GENERATIONS = threading.BoundedSemaphore(int(os.environ.get("MAX_PARALLEL", "2")))

SYSTEM_PROMPT = (
    "You answer questions about archival documents. Use only the numbered "
    "passages given to you. If they do not contain the answer, say that the "
    "documents provided do not say. Mention the title of the passage you used. "
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


def ollama_connected():
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=3) as res:
            names = [m.get("name") for m in json.load(res).get("models", [])]
        return MODEL in names
    except (urllib.error.URLError, OSError, ValueError):
        return False


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
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
        self.send_json(401, {"error": "unauthorised"})
        return False

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("request too large")
        return json.loads(self.rfile.read(length) or b"{}")

    def session_id(self, body=None):
        sid = (body or {}).get("session_id") or self.headers.get("X-Session-ID") or ""
        return sid if 0 < len(sid) <= 200 else None

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            ok = ollama_connected()
            return self.send_json(200, {"status": "healthy" if ok else "degraded",
                                        "ollama_connected": ok, "model": MODEL})
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
                pieces = ollama_chat(build_messages(message, hits), config)

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
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True

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
    print(f"listening on :{PORT}, model {MODEL} at {OLLAMA_URL}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
