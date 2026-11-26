#!/usr/bin/env python3
"""Synthesises the narration of a demo-video script with Kokoro (ja: jf_alpha, en: af_heart).

Uses ~/git/blog/common/kokoro/kokoro_core.py (the same voices and reading rules as the
blog's videos). Run it with the Python that has kokoro and misaki[ja]:

  PY=~/git/zenn/scripts/media/kokoro-ja/.venv/bin/python
  $PY scripts/demo-video/voice.py scripts/demo-video/green-fee.json <out-dir> ja|en

Each step's spoken text is step.say[lang] if given, else the caption step[lang].
Writes <out-dir>/voice/<narration|narration-en>/kokoro/<key>.wav and
<out-dir>/<name>.<lang>.voice.json: {"<step index>": {"wav": path, "sec": seconds}}.
record.mjs reads that file, holds each step until its voice ends, and mixes the voice in.
Readings Kokoro gets wrong go in <out-dir>/voice/<narration|narration-en>/readings.csv.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.home() / 'git/blog/common/kokoro'))
import kokoro_core as K  # noqa: E402

script_path, out_dir, lang = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
script = json.loads(Path(script_path).read_text(encoding='utf-8'))
project = out_dir / 'voice'
rd = K.load_readings(project, lang)
man = K.manifest(project, lang)
out = {}
for i, step in enumerate(script['steps']):
    text = (step.get('say') or {}).get(lang) or step.get(lang)
    if not text:
        continue
    r = K.synth(project, lang, text, man, rd)
    wav = K.work_dir(project, lang) / 'kokoro' / f"{r['key']}.wav"
    out[str(i)] = {'wav': str(wav.resolve()), 'sec': r['sec']}
    print(f"{i:2d} {r['sec']:5.1f}s {man[r['key']]['spoken'][:60]}")
name = script.get('name', 'demo')
(out_dir / f'{name}.{lang}.voice.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
print(f"{len(out)} clips, {sum(v['sec'] for v in out.values()):.1f} s")
