"""Knowledge chunks for the Clio-X "Chatbot" page (/usecases/chatbot).

Splits every input document into passages of about 250 words and writes them
to final_output.json — the file name the page looks for. The page sends these
passages to the chatbot server, which answers questions from them:

  [{"id": "federalist-10.txt#3",
    "content": "...passage text...",
    "metadata": {"source": "federalist-10.txt", "title": "...", "date": "1787-11-22",
                 "chunk": 3}}]

Input: any files under /data/inputs — plain text, TEI/XML (tags removed), or
.tar.gz / .tgz / .tar / .zip archives of them. A header block at the top of a
document ("Title: …", "Date: …", then a blank line) goes into the metadata and
is prepended to each passage so the chatbot can cite it.

Japanese text (no spaces) is cut by length instead: about 400 characters.

Standard library only, so any python image works. The full documents never
leave the node; the passages do — so use this only on material that may be
quoted, as with any search index.
"""
import io
import json
import re
import tarfile
import zipfile
from pathlib import Path

INPUTS = Path("/data/inputs")
OUTPUTS = Path("/data/outputs")
TEXT_SUFFIXES = {".txt", ".xml", ".md", ".eml", ".csv", ".json", ""}
WORDS_PER_CHUNK = 250
CHARS_PER_CHUNK = 400
HEADER = re.compile(r"^([A-Za-z-]{2,30}):[ \t]*(.*)$")


def decode(data: bytes) -> str:
    for enc in ("utf-8", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def strip_xml(text: str) -> str:
    body = re.search(r"<text\b.*?</text>", text, flags=re.S)
    text = body.group(0) if body else text
    text = re.sub(r"<(note|teiHeader)\b.*?</\1>", " ", text, flags=re.S)
    text = re.sub(r"<(lb|pb|cb)\b[^>]*/>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[ \t]+", " ", text)


def documents():
    for path in sorted(p for p in INPUTS.rglob("*") if p.is_file()):
        if path.name != "algoCustomData.json":
            yield from from_bytes(path.name, path.read_bytes())


def from_bytes(name: str, data: bytes):
    if data[:2] == b"\x1f\x8b" or data[257:262] == b"ustar":
        with tarfile.open(fileobj=io.BytesIO(data)) as tar:
            for m in sorted(tar.getmembers(), key=lambda m: m.name):
                if m.isfile():
                    yield from from_bytes(m.name, tar.extractfile(m).read())
    elif data[:4] == b"PK\x03\x04":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for n in sorted(z.namelist()):
                if not n.endswith("/"):
                    yield from from_bytes(n, z.read(n))
    elif Path(name).suffix.lower() in TEXT_SUFFIXES:
        text = decode(data)
        if text.lstrip().startswith("<"):
            text = strip_xml(text)
        yield Path(name).name, text


def drop_comments(text: str) -> str:
    """Lines starting with "# " are notes about the file (source, licence)."""
    return "\n".join(line for line in text.splitlines() if not line.startswith("# "))


def split_header(text: str):
    lines = text.lstrip("﻿").splitlines()
    header = {}
    for i, line in enumerate(lines):
        if not line.strip():
            if header:
                return header, "\n".join(lines[i + 1 :])
            break
        m = HEADER.match(line)
        if not m:
            break
        header[m.group(1).lower()] = m.group(2).strip()
    return {}, text


def passages(body: str):
    """Group paragraphs into passages of about WORDS_PER_CHUNK words."""
    paragraphs = [" ".join(p.split()) for p in re.split(r"\n\s*\n", body) if p.strip()]
    spaced = sum(p.count(" ") for p in paragraphs) > len("".join(paragraphs)) / 20
    if not spaced:  # Japanese and similar: cut by characters
        text = "".join(paragraphs)
        return [text[i : i + CHARS_PER_CHUNK] for i in range(0, len(text), CHARS_PER_CHUNK)]
    out, current, size = [], [], 0
    for p in paragraphs:
        n = len(p.split())
        if current and size + n > WORDS_PER_CHUNK:
            out.append(" ".join(current))
            current, size = [], 0
        current.append(p)
        size += n
    if current:
        out.append(" ".join(current))
    return out


def main() -> None:
    chunks = []
    for name, raw in documents():
        header, body = split_header(drop_comments(raw))
        # Files inside a job are named by position ("0"), so without a header
        # the first line of the text is the better title.
        first = next((line.strip() for line in body.splitlines() if line.strip()), name)
        title = header.get("title") or (first[:80] if name.isdigit() else name)
        about = ", ".join(header[k] for k in ("author", "date") if header.get(k))
        label = title + (f" ({about})" if about else "")
        for i, text in enumerate(passages(body), 1):
            metadata = {"source": name, "title": title, "chunk": i}
            for key in ("date", "author"):
                if header.get(key):
                    metadata[key] = header[key]
            chunks.append(
                {"id": f"{name}#{i}", "content": f"{label}\n\n{text}", "metadata": metadata}
            )
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    (OUTPUTS / "final_output.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=1))
    print(f"{len(chunks)} passages from {len({c['metadata']['source'] for c in chunks})} documents")


if __name__ == "__main__":
    main()
