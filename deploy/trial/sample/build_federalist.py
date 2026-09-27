"""Build the Federalist Papers sample dataset for the use-case pages.

Source: Project Gutenberg eBook #1404 (public domain in the USA), the plain
text file https://www.gutenberg.org/cache/epub/1404/pg1404.txt.
The Gutenberg header and licence footer are dropped (body only), as for the
Declaration of Independence sample.

Output: federalist-papers.tar.gz — one text file per paper, each starting with
a small header block, then a blank line, then the text:

    Title: FEDERALIST No. 10 - The Same Subject Continued (...)
    Author: MADISON
    Published: From the Daily Advertiser.
    Date: 1787-11-22

The dated header is what lets the text-analysis algorithm draw a timeline.
The archive is reproducible (fixed order, mtime 0), so its checksum only changes
when the source changes.

Usage:
    curl -sL -o pg1404.txt https://www.gutenberg.org/cache/epub/1404/pg1404.txt
    python3 build_federalist.py pg1404.txt federalist-papers.tar.gz
"""
import gzip
import io
import re
import sys
import tarfile
from datetime import datetime

DATE = re.compile(
    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
    r"([A-Z][a-z]+ \d{1,2}, 17\d\d)"
)
SOURCE = re.compile(r"\b(?:For|From) (?:the|The|MCLEAN|McLEAN)\b")
# Errors in the Gutenberg text, found by checking each date against its weekday.
# No. 26 reads "Saturday, December 22, 1788"; 22 Dec 1788 was a Monday, and the
# paper appeared in the Independent Journal on Saturday 22 Dec 1787.
CORRECTIONS = {26: "1787-12-22"}
AUTHOR = re.compile(r"^[A-Z]{3,}(?:(?:,? with| OR| AND|,) [A-Z]{3,})*$")


def papers(text: str):
    body = text.split("*** START OF THE PROJECT GUTENBERG EBOOK")[1].split("\n", 1)[1]
    body = body.split("*** END OF THE PROJECT GUTENBERG EBOOK")[0]
    parts = re.split(r"^FEDERALIST No\. (\d+)\s*$", body, flags=re.M)
    for number, chunk in zip(parts[1::2], parts[2::2]):
        blocks = [b.strip() for b in re.split(r"\n\s*\n", chunk.strip())]
        # Title, then the publication line with its date, then the author.
        # The title may run over several paragraphs, and in a few papers the
        # publication line shares a paragraph with the end of the title.
        lines = [" ".join(b.split()) for b in blocks]
        at = next((i for i, line in enumerate(lines[:4]) if DATE.search(line)), None)
        published, date = "", ""
        if at is None:
            title, rest = lines[0], blocks[1:]
        else:
            m = DATE.search(lines[at])
            day = datetime.strptime(m.group(1), "%B %d, %Y").date()
            date = CORRECTIONS.get(int(number), day.isoformat())
            weekday = datetime.fromisoformat(date).strftime("%A")
            if not m.group(0).startswith(weekday):
                raise SystemExit(f"No. {number}: {m.group(0)!r} is not a {weekday}")
            head = lines[at][: m.start()].strip()
            starts = [s.start() for s in SOURCE.finditer(head)]
            cut = starts[-1] if starts else len(head)
            title = " ".join(lines[:at] + [head[:cut]]).strip()
            published = head[cut:].strip()
            rest = blocks[at + 1 :]
        # "HAMILTON", "MADISON, with HAMILTON", "HAMILTON OR MADISON"
        author = rest[0] if rest and AUTHOR.match(rest[0]) else ""
        if author:
            rest = rest[1:]
        head = [f"Title: FEDERALIST No. {number} - {title}"]
        if author:
            head.append(f"Author: {author}")
        if published:
            head.append(f"Published: {published}")
        if date:
            head.append(f"Date: {date}")
        yield int(number), "\n".join(head) + "\n\n" + "\n\n".join(rest) + "\n"


def main(src: str, dst: str) -> None:
    text = open(src, encoding="utf-8").read()
    items = list(papers(text))
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        for number, content in items:
            data = content.encode("utf-8")
            info = tarfile.TarInfo(f"federalist-papers/federalist-{number:02d}.txt")
            info.size, info.mtime, info.mode = len(data), 0, 0o644
            tar.addfile(info, io.BytesIO(data))
    with open(dst, "wb") as f:
        f.write(gzip.compress(raw.getvalue(), compresslevel=9, mtime=0))
    dated = sum("\nDate: " in c for _, c in items)
    print(f"{len(items)} papers, {dated} dated -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
