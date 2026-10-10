"""Build one study-handout markdown per level (= Udemy section) from a merged manual.

Usage: extract_dispense.py <manual.md> <out_dir> <slug>
Writes <out_dir>/<slug>-sezione-<k>.md for each '# LIVELLO' of the manual.
Each lesson keeps: objectives, key points (In sintesi), references, common mistakes,
exercise with solution — taken verbatim from the manual.
"""
import re, sys, pathlib

KEEP = [
    ("In sintesi", "Punti chiave"),
    ("Riferimenti", "Norme, principi e riferimenti"),
    ("Errori comuni", "Errori comuni da evitare"),
    ("Esercizio", "Esercizio di verifica"),
]


def split(text, pattern):
    parts = re.split(pattern, text, flags=re.M)
    return parts[0], list(zip(parts[1::2], parts[2::2]))


def lesson_sheet(title, body):
    out = [f"## {title}", ""]
    m = re.search(r"\*\*Obiettivi della lezione\*\*\s*\n(.*?)(?=\n### |\Z)", body, re.S)
    if m:
        out += ["### Obiettivi", "", m.group(1).strip(), ""]
    _, subs = split(body, r"^### (.+)$")
    for key, label in KEEP:
        for head, content in subs:
            if head.strip().startswith(key):
                content = re.sub(r"\n-{3,}\s*$", "", content.strip())
                out += [f"### {label}", "", content, ""]
                break
    return "\n".join(out)


def main(manual, out_dir, slug):
    text = pathlib.Path(manual).read_text(encoding="utf-8")
    text = text[: text.index("## Indice riassuntivo")] if "## Indice riassuntivo" in text else text
    _, levels = split(text, r"^# (LIVELLO .+)$")
    out_dir = pathlib.Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for k, (lvl, body) in enumerate(levels, 1):
        intro, lessons = split(body, r"^(## Lezione \d+ — .+)$")
        name = lvl.split("—", 1)[-1].strip()
        level = lvl.split("—", 1)[0].replace("LIVELLO", "Livello").strip().title()
        intro = re.sub(r"\n-{3,}\s*$", "", intro.strip())
        doc = [f"# {level} — {name}", "",
               "Questa dispensa raccoglie, lezione per lezione, gli obiettivi, i punti chiave da ricordare, "
               "i riferimenti normativi, gli errori più comuni e un esercizio con soluzione. Usala per ripassare "
               "dopo ogni video e prima del quiz di fine sezione.", "", intro, ""]
        for head, content in lessons:
            doc.append(lesson_sheet(head.replace("## ", "", 1), content))
        p = out_dir / f"{slug}-sezione-{k}.md"
        p.write_text("\n".join(doc), encoding="utf-8")
        print(p.name, len(lessons), "lezioni", len("\n".join(doc).split()), "parole")


if __name__ == "__main__":
    main(*sys.argv[1:])
