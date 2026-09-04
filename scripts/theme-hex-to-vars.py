# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(__file__).resolve().parents[1] / "css" / "style.css"
text = p.read_text(encoding="utf-8")
pairs = [
    ("#2563eb", "var(--eprof-accent, #2563eb)"),
    ("#1e40af", "var(--eprof-accent-dark, #1e40af)"),
    ("#1e3a8a", "var(--eprof-chrome, #1e3a8a)"),
    ("#10b981", "var(--eprof-success, #10b981)"),
    ("#ef4444", "var(--eprof-danger, #ef4444)"),
]
for hexcol, var in pairs:
    text = text.replace(hexcol, var)
# Collapse accidental double wrapping
for _ in range(3):
    text = text.replace("var(--eprof-accent, var(--eprof-accent, #2563eb))", "var(--eprof-accent, #2563eb)")
    text = text.replace("var(--eprof-accent-dark, var(--eprof-accent-dark, #1e40af))", "var(--eprof-accent-dark, #1e40af)")
    text = text.replace("var(--eprof-chrome, var(--eprof-chrome, #1e3a8a))", "var(--eprof-chrome, #1e3a8a)")
    text = text.replace("var(--eprof-success, var(--eprof-success, #10b981))", "var(--eprof-success, #10b981)")
    text = text.replace("var(--eprof-danger, var(--eprof-danger, #ef4444))", "var(--eprof-danger, #ef4444)")
p.write_text(text, encoding="utf-8")
print("style.css updated, length", len(text.splitlines()))
