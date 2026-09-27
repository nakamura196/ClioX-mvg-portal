"""Text analysis for the Clio-X "Visualizations" page (/usecases/visualizations).

Writes the five files the page looks for, by name, in the job's results:

  wordcloud.json          [{"value": word, "count": n}]            top 150 words
  sentiment.json          [{"name": "-2".."+2", "values": [[date, n, words]]}]
                          sentences per sentiment level per day (dated documents only)
  date_distribution.csv   time,count        documents per day (timeline)
  email_distribution.csv  emails_per_day    one row per day with documents (histogram)
  document_summary.json   totals, vocabulary density, readability, frequent words

Input: any files under /data/inputs — plain text, TEI/XML (tags removed), or
.tar.gz / .tgz / .tar / .zip archives of them. A document may start with a
header block ("Title: …", "Date: 1787-10-27" or an e-mail style date, then a
blank line); the date is what places it on the timeline. Documents without a
date still count in the word cloud and the summary.

Sentiment uses a small built-in word list. It is a demonstration of the chart,
not a validated sentiment model; read it as "sentences with more positive or
negative words", nothing more.

Japanese text: runs of kanji or katakana (2+ characters) count as words.

Standard library only, so any python image works. The documents never leave
the node; only these summaries do.
"""
import csv
import io
import json
import re
import tarfile
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

INPUTS = Path("/data/inputs")
OUTPUTS = Path("/data/outputs")
TEXT_SUFFIXES = {".txt", ".xml", ".md", ".eml", ".csv", ".json", ""}

STOP = set(
    """a about above after again against all also am an and any are as at be
    because been before being below between both but by can could did do does
    doing down during each few for from further had has have having he her here
    hers him his how i if in into is it its itself just may me might more most
    must my no nor not now of off on once only or other ought our ours out over
    own same shall she should so some such than that the their theirs them then
    there these they this those through to too under until up upon very was we
    were what when where which while who whom why will with would you your
    one two three first new every many much made make well without within""".split()
)

# Weights -2..+2. A short, general-purpose list; see the note above.
LEXICON = {
    **dict.fromkeys(
        "good happy benefit benefits safe safety secure security peace peaceful "
        "prosperity prosperous liberty free freedom justice just wise wisdom "
        "support agree agreement honest honor useful strong strength respect "
        "welfare harmony confidence praise glad fair hope improve improvement "
        "success advantage advantages protect protection".split(),
        1,
    ),
    **dict.fromkeys(
        "excellent great greatest happiness blessing blessings admirable "
        "wonderful perfect best glory".split(),
        2,
    ),
    **dict.fromkeys(
        "bad danger dangerous weak weakness fear threat problem problems "
        "difficulty difficulties conflict dispute disputes loss lose error "
        "abuse abuses oppression violence injury injustice unjust unfair poor "
        "decline disorder hostile hostility jealousy ambition corrupt "
        "corruption discord faction factions".split(),
        -1,
    ),
    **dict.fromkeys(
        "war wars tyranny tyrant despotism destruction ruin disaster terrible "
        "worst anarchy murder slavery calamity calamities".split(),
        -2,
    ),
}

WORD = re.compile(r"[A-Za-z][A-Za-z'-]+|[一-鿿々]{2,}|[゠-ヿ]{2,}")
SENTENCE = re.compile(r"(?<=[.!?。！？])\s+|\n{2,}")
HEADER = re.compile(r"^([A-Za-z-]{2,30}):[ \t]*(.*)$")


# --- reading ---------------------------------------------------------------

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
    """Yield (name, text) for every text document, opening archives."""
    for path in sorted(p for p in INPUTS.rglob("*") if p.is_file()):
        if path.name == "algoCustomData.json":
            continue
        data = path.read_bytes()
        yield from from_bytes(path.name, data)


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
        yield name, text


def drop_comments(text: str) -> str:
    """Lines starting with "# " are notes about the file (source, licence)."""
    return "\n".join(line for line in text.splitlines() if not line.startswith("# "))


def split_header(text: str):
    """Return ({key: value}, body) if the text starts with a header block."""
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


def parse_date(value: str):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(value).date()
    except (TypeError, ValueError):
        return None


# --- analysis --------------------------------------------------------------

def words_of(text: str):
    return [w.lower().strip("'-") for w in WORD.findall(text)]


def sentiment_level(words) -> int:
    score = sum(LEXICON.get(w, 0) for w in words)
    return max(-2, min(2, score))


def main() -> None:
    counts = Counter()
    total_words = total_sentences = total_letters = 0
    per_day = Counter()
    sentiment = defaultdict(Counter)       # level -> day -> sentences
    sentiment_words = defaultdict(Counter)  # (level, day) -> words
    names = []
    vocabulary = set()

    for name, raw in documents():
        header, body = split_header(drop_comments(raw))
        day = parse_date(header.get("date", ""))
        names.append(name)
        if day:
            per_day[day] += 1
        for sentence in (s for s in SENTENCE.split(body) if s.strip()):
            ws = words_of(sentence)
            if not ws:
                continue
            total_sentences += 1
            total_words += len(ws)
            total_letters += sum(len(w) for w in ws)
            vocabulary.update(ws)
            counts.update(w for w in ws if (w not in STOP and len(w) > 2) or not w.isascii())
            if day:
                level = sentiment_level(ws)
                sentiment[level][day] += 1
                sentiment_words[(level, day)].update(w for w in ws if w in LEXICON)

    OUTPUTS.mkdir(parents=True, exist_ok=True)

    def write_json(fname, obj):
        (OUTPUTS / fname).write_text(json.dumps(obj, ensure_ascii=False, indent=1))

    write_json("wordcloud.json", [{"value": w, "count": c} for w, c in counts.most_common(150)])

    days = sorted(per_day)
    write_json(
        "sentiment.json",
        [
            {
                "name": f"{level:+d}" if level else "0",
                "values": [
                    [
                        f"{day.isoformat()}T00:00:00Z",
                        sentiment[level][day],
                        [w for w, _ in sentiment_words[(level, day)].most_common(8)],
                    ]
                    for day in days
                ],
            }
            for level in (-2, -1, 0, 1, 2)
        ]
        if days
        else [],
    )

    with open(OUTPUTS / "date_distribution.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "count"])
        w.writerows((d.isoformat(), per_day[d]) for d in days)

    with open(OUTPUTS / "email_distribution.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["emails_per_day"])
        w.writerows([per_day[d]] for d in days)

    unique = len(vocabulary)
    words_per_sentence = total_words / total_sentences if total_sentences else 0
    letters_per_word = total_letters / total_words if total_words else 0
    write_json(
        "document_summary.json",
        {
            "totalDocuments": len(names),
            "totalWords": total_words,
            "uniqueWords": unique,
            "vocabularyDensity": round(unique / total_words, 4) if total_words else 0,
            # Automated Readability Index (US school grade), from letters per
            # word and words per sentence.
            "readabilityIndex": round(4.71 * letters_per_word + 0.5 * words_per_sentence - 21.43, 3)
            if total_words
            else 0,
            "wordsPerSentence": round(words_per_sentence, 2),
            "frequentWords": [{"word": w, "count": c} for w, c in counts.most_common(20)],
            "created": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        },
    )
    print(
        f"{len(names)} documents, {total_words} words, {len(days)} dated days; "
        f"top: {counts.most_common(5)}"
    )


if __name__ == "__main__":
    main()
