# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(__file__).resolve().parents[1] / "js" / "app.js"
lines = p.read_text(encoding="utf-8").splitlines(True)
keep = []
for i, line in enumerate(lines, 1):
    if 1167 <= i <= 2353:
        continue
    if 2465 <= i <= 3001:
        continue
    keep.append(line)
p.write_text("".join(keep), encoding="utf-8")
print("app.js lines", len(keep))
