"""Profile each chapter of the Kōi Genji monogatari TEI/XML: pages, lines,
characters and the most frequent characters.

A Compute-to-Data example for the Clio-X trial: the 54 TEI files stay on the
node; only this per-chapter summary is returned.

Inside the job container (Ocean Node):
  /data/inputs/<did>/<n>   the dataset files (n = 0, 1, ... in the order of the asset)
  /data/outputs/           whatever is written here is returned to the requester
Standard library only, so any python image works.
"""
import csv
import json
import os
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

INPUTS = Path("/data/inputs")
OUTPUTS = Path("/data/outputs")
TEI = "{http://www.tei-c.org/ns/1.0}"

# Iteration marks and punctuation say little about the text itself.
SKIP = set("〱〲ゝゞ々・、。「」 \t\r\n")


def profile(path: Path) -> dict:
    root = ET.parse(path).getroot()
    titles = root.findall(f"{TEI}teiHeader/{TEI}fileDesc/{TEI}titleStmt/{TEI}title")
    title = next((t.text for t in titles if t.get("type") is None), "")
    alt = next((t.text for t in titles if t.get("type") == "alt"), "")
    body = root.find(f"{TEI}text/{TEI}body")
    lines = ["".join(seg.itertext()).strip() for seg in body.iter(f"{TEI}seg")]
    chars = Counter(c for line in lines for c in line if c not in SKIP)
    pages = [pb.get("n") for pb in body.iter(f"{TEI}pb")]
    return {
        "file": str(path.relative_to(INPUTS)),
        "title": title,
        "title_alt": alt,
        "pages": len(pages),
        "first_page": pages[0] if pages else None,
        "last_page": pages[-1] if pages else None,
        "lines": len(lines),
        "characters": sum(chars.values()),
        "top_characters": chars.most_common(10),
    }


def order(path: Path):
    return (str(path.parent), int(path.name) if path.name.isdigit() else path.name)


def main() -> None:
    files = sorted(
        (p for p in INPUTS.rglob("*") if p.is_file() and p.name != "algoCustomData.json"),
        key=order,
    )
    chapters = [profile(p) for p in files]
    result = {
        "algorithm": "genji_profile 1.0 (Clio-X trial)",
        "datasets": json.loads(os.environ.get("DIDS", "[]") or "[]"),
        "totals": {
            "chapters": len(chapters),
            "pages": sum(c["pages"] for c in chapters),
            "lines": sum(c["lines"] for c in chapters),
            "characters": sum(c["characters"] for c in chapters),
        },
        "chapters": chapters,
    }
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    (OUTPUTS / "genji_profile.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    with open(OUTPUTS / "genji_profile.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "title", "title_alt", "pages", "first_page", "last_page", "lines", "characters"])
        for c in chapters:
            w.writerow([c[k] for k in ("file", "title", "title_alt", "pages", "first_page", "last_page", "lines", "characters")])
    print(json.dumps(result["totals"], ensure_ascii=False))


if __name__ == "__main__":
    main()
