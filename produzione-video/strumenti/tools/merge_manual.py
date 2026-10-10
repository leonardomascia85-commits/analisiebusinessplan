"""Merge rewritten level parts into the full guide.

Usage: merge_manual.py <original.md> <out.md> <part1.md> [part2.md ...]
Keeps the original header (up to the first '# LIVELLO'), the original index and sources,
inserts the parts in order and moves each part's '## Fonti aggiunte…' section into the sources.
"""
import re, sys, pathlib

NOTE = """
**Come è strutturata ogni lezione.** Ogni lezione segue lo stesso schema, pensato per lo studio e per il ripasso: gli **obiettivi** (cosa saprai fare alla fine), la **spiegazione** divisa in paragrafi tematici, i **riferimenti normativi e principi** da conoscere, un **esempio pratico** svolto passo per passo, gli **errori comuni da evitare**, un **esercizio con soluzione** e una **sintesi** finale da rileggere prima di passare alla lezione successiva.
"""


def main(orig, out, *parts):
    src = pathlib.Path(orig).read_text(encoding="utf-8")
    head = src[: src.index("\n# LIVELLO") + 1]
    tail = src[src.index("## Indice riassuntivo"):]
    if "Come è strutturata ogni lezione" not in head:
        head = head.rstrip().rstrip("-").rstrip() + "\n" + NOTE + "\n---\n\n"
    body, extra = [], []
    for p in parts:
        t = pathlib.Path(p).read_text(encoding="utf-8").strip()
        m = re.search(r"^## Fonti aggiunte[^\n]*\n", t, re.M)
        if m:
            extra.append(t[m.end():].strip())
            t = t[: m.start()].rstrip()
        t = re.sub(r"\n-{3,}\s*$", "", t)
        body.append(t)
    merged = head + "\n\n---\n\n".join(body) + "\n\n---\n\n" + tail.rstrip() + "\n"
    if extra:
        merged += "\n### Fonti aggiuntive verificate per l'edizione ampliata\n\n" + "\n".join(extra) + "\n"
    pathlib.Path(out).write_text(merged, encoding="utf-8")
    lessons = re.findall(r"^## Lezione (\d+)", merged, re.M)
    print(out, len(merged.split()), "parole,", len(lessons), "lezioni:", ",".join(lessons))


if __name__ == "__main__":
    main(*sys.argv[1:])
