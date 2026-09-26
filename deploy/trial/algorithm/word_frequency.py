"""Count the most frequent words in each input document.

A minimal Compute-to-Data example for the Clio-X trial: the document never
leaves the node; only this summary does.

Inside the job container (Ocean Node):
  /data/inputs/<did>/<n>   the dataset files
  /data/outputs/           whatever is written here is returned to the requester
Standard library only, so any python image works.
"""
import json
import os
import re
from collections import Counter
from pathlib import Path

INPUTS = Path("/data/inputs")
OUTPUTS = Path("/data/outputs")

# Very common English words that say little about the content.
STOP = set(
    "the of and to in a that be for as by our is has it with on have are "
    "we he his their them they these this all or which from its been an at "
    "not us any other such may should when so shall".split()
)


def summarise(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    text = "\n".join(line for line in lines if not line.startswith("#"))
    words = re.findall(r"[a-z]+", text.lower())
    counts = Counter(w for w in words if w not in STOP and len(w) > 2)
    return {
        "file": str(path.relative_to(INPUTS)),
        "words_total": len(words),
        "top_words": counts.most_common(20),
    }


def main() -> None:
    files = sorted(p for p in INPUTS.rglob("*") if p.is_file() and p.name != "algoCustomData.json")
    result = {
        "algorithm": "word_frequency 1.0 (Clio-X trial)",
        "datasets": json.loads(os.environ.get("DIDS", "[]") or "[]"),
        "documents": [summarise(p) for p in files],
    }
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    (OUTPUTS / "word_frequency.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps(result)[:500])


if __name__ == "__main__":
    main()
