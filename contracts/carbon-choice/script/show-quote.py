# Print a quote from quote-reward.mjs (stdin) for people; exit 1 if refused.
import json, sys
q = json.load(sys.stdin)
if not q["ok"]:
    print("✗", q["reason"]); sys.exit(1)
c = q["claim"]
print(f"  owner {c['recipient']}, ran {q['runSeconds']:.1f} s on {q['cpu']} vCPU")
for o in q["options"]:
    mark = "  ← chosen" if o["chosen"] else ""
    print(f"  {o['key']:22s} {o['ug']/1000:8.2f} mg{mark}")
print(f"  expected reward {q['expectedUnits']/1e6:.3f} PLAY")
