# -*- coding: utf-8 -*-
"""Extract student portraits from Pronote-style trombinoscope PDFs."""
import json
import re
import unicodedata
from pathlib import Path

import pymupdf

ROOT = Path(r"C:\Users\Adrien\Desktop\Code\online projects\eProf")
PDF_DIR = ROOT / "Trombinoscopes" / "2026-2027"
OUT_JS = ROOT / "js" / "trombi-photos.js"

CLASS_CODES = {
    "TSAPA": "Tle SAPAT A",
    "TSAPB": "Tle SAPAT B",
}


def ascii_fold(text):
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii")


def slug(text):
    folded = ascii_fold(text)
    folded = re.sub(r"[^A-Za-z0-9]+", "_", folded).strip("_")
    return folded or "eleve"


def parse_name(text):
    text = text.replace("|", " ").replace("--", "-")
    text = re.sub(r"\s+", " ", text).strip()
    parts = text.split(" ")
    nom_parts = []
    prenom_parts = []
    switched = False
    for part in parts:
        letters = re.sub(r"[^A-Za-z]", "", ascii_fold(part))
        if not switched and letters and letters == letters.upper():
            nom_parts.append(part.replace("--", "-"))
        else:
            switched = True
            prenom_parts.append(part)
    if not prenom_parts and nom_parts:
        prenom_parts = [nom_parts.pop()]
    return " ".join(nom_parts), " ".join(prenom_parts)


def key(nom, prenom):
    return ascii_fold(f"{nom}|{prenom}").upper().replace("  ", " ").strip()


def class_from_pdf(page, pdf_name):
    text = page.get_text("text") or ""
    match = re.search(r"Classe\s*:\s*([A-Z0-9]+)", text)
    if match and match.group(1) in CLASS_CODES:
        return CLASS_CODES[match.group(1)]
    lowered = pdf_name.lower()
    if "sapat a" in lowered:
        return "Tle SAPAT A"
    if "sapat b" in lowered:
        return "Tle SAPAT B"
    return Path(pdf_name).stem


def collect_name_blocks(page):
    blocks = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        lines = []
        for line in block.get("lines", []):
            t = "".join(span.get("text", "") for span in line.get("spans", []))
            if t.strip():
                lines.append(t.strip())
        if not lines:
            continue
        text = " ".join(lines)
        if text.startswith("Classe"):
            continue
        if re.match(r"^\d{4}\s*-\s*\d{4}$", text):
            continue
        if re.match(r"^\d{2}/\d{2}/\d{4}$", text):
            continue
        blocks.append({"bbox": block["bbox"], "text": text})
    return blocks


def extract_pdf(pdf_path):
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    classe = class_from_pdf(page, pdf_path.name)

    portraits = []
    seen_rects = set()
    for img in page.get_images(full=True):
        xref, width, height = img[0], img[2], img[3]
        if width < 60 or height < 80:
            continue
        for rect in page.get_image_rects(xref):
            key_rect = (round(rect.x0, 1), round(rect.y0, 1), round(rect.x1, 1), round(rect.y1, 1))
            if key_rect in seen_rects:
                continue
            seen_rects.add(key_rect)
            portraits.append({"xref": xref, "rect": rect})
    portraits.sort(key=lambda p: (round(p["rect"].y0 / 8), p["rect"].x0))

    names = collect_name_blocks(page)
    used = set()
    students = []
    for portrait in portraits:
        rect = portrait["rect"]
        cx = (rect.x0 + rect.x1) / 2
        candidates = []
        for i, block in enumerate(names):
            if i in used:
                continue
            bx0, by0, bx1, by1 = block["bbox"]
            tcx = (bx0 + bx1) / 2
            if by0 < rect.y1 - 6 or by0 > rect.y1 + 55:
                continue
            if abs(tcx - cx) > 58:
                continue
            candidates.append((abs(tcx - cx) + max(0, by0 - rect.y1) * 0.2, i, block))
        if not candidates:
            print(f"  ! photo sans nom ({pdf_path.name} x={rect.x0:.0f} y={rect.y0:.0f})")
            continue
        candidates.sort()
        parts = []
        for dist, i, block in candidates:
            if abs(((block["bbox"][0] + block["bbox"][2]) / 2) - cx) <= 45:
                parts.append(block["text"])
                used.add(i)
        full = " ".join(parts)
        nom, prenom = parse_name(full)
        students.append({
            "classe": classe,
            "nom": nom,
            "prenom": prenom,
            "xref": portrait["xref"],
            "page": page,
        })
    return classe, students


def write_js(catalog):
    payload = {
        "annee": "2026-2027",
        "classes": {},
        "eleves": {},
    }
    for classe, students in catalog.items():
        payload["classes"][classe] = []
        payload["eleves"][classe] = {}
        for student in students:
            payload["classes"][classe].append({
                "nom": student["nom"],
                "prenom": student["prenom"],
            })
            payload["eleves"][classe][student["key"]] = student["src"]

    js = f"""/* Photos trombinoscope extraites des PDF Pronote (année 2026-2027). */
window.EPROF_TROMBI_PHOTOS = {json.dumps(payload, ensure_ascii=False, indent=2)};

(function (global) {{
    var DATA = global.EPROF_TROMBI_PHOTOS || {{ eleves: {{}}, classes: {{}} }};

    function norm(value) {{
        return String(value || '')
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/['’]/g, '')
            .replace(/--/g, '-')
            .replace(/\\s+/g, ' ')
            .trim()
            .toUpperCase();
    }}

    function makeKey(nom, prenom) {{
        return norm(nom) + '|' + norm(prenom);
    }}

    function lookup(classe, nom, prenom) {{
        var byClass = (DATA.eleves || {{}})[classe];
        if (!byClass) return null;
        var exact = byClass[makeKey(nom, prenom)];
        if (exact) return exact;
        var nNom = norm(nom);
        var nPrenom = norm(prenom);
        var keys = Object.keys(byClass);
        for (var i = 0; i < keys.length; i++) {{
            var parts = keys[i].split('|');
            if (parts[0] === nNom && parts[1] === nPrenom) return byClass[keys[i]];
        }}
        var hits = [];
        for (var j = 0; j < keys.length; j++) {{
            var p = keys[j].split('|');
            if (p[0] === nNom && (p[1].indexOf(nPrenom) !== -1 || nPrenom.indexOf(p[1]) !== -1)) {{
                hits.push(byClass[keys[j]]);
            }}
        }}
        return hits.length === 1 ? hits[0] : null;
    }}

    function studentsForClass(classe) {{
        return ((DATA.classes || {{}})[classe] || []).map(function (e) {{
            return {{ nom: e.nom, prenom: e.prenom }};
        }});
    }}

    global.EprofTrombiPhotos = {{ lookup: lookup, studentsForClass: studentsForClass }};
}})(window);
"""
    OUT_JS.write_text(js, encoding="utf-8")


def wipe_class_photos(classe):
    out_dir = PDF_DIR / "photos" / classe
    if not out_dir.is_dir():
        return 0
    removed = 0
    for path in out_dir.glob("*.jpg"):
        path.unlink()
        removed += 1
    return removed


def main():
    catalog = {}
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"Aucun PDF dans {PDF_DIR}")

    for classe in ("Tle SAPAT A", "Tle SAPAT B"):
        n = wipe_class_photos(classe)
        print(f"nettoyage {classe}: {n} ancienne(s) photo(s)")

    for pdf_path in pdfs:
        print("==", pdf_path.name)
        classe, students = extract_pdf(pdf_path)
        out_dir = PDF_DIR / "photos" / classe
        out_dir.mkdir(parents=True, exist_ok=True)
        catalog.setdefault(classe, [])
        used_names = set()
        for student in students:
            base = f"{slug(student['nom'])}_{slug(student['prenom'])}"
            filename = base + ".jpg"
            n = 2
            while filename.lower() in used_names:
                filename = f"{base}_{n}.jpg"
                n += 1
            used_names.add(filename.lower())
            pix = pymupdf.Pixmap(student["page"].parent, student["xref"])
            if pix.n > 4:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            dest = out_dir / filename
            pix.save(str(dest))
            rel = dest.relative_to(ROOT).as_posix()
            student["src"] = rel
            student["key"] = key(student["nom"], student["prenom"])
            catalog[classe].append(student)
            print(f"  {student['prenom']} {student['nom']} -> {rel}")
        print(f"  total {len(students)} photo(s) pour {classe}")

    write_js(catalog)
    print("écrit", OUT_JS)


if __name__ == "__main__":
    main()
