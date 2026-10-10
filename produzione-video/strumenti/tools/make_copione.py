"""Printable recording script (markdown) for one course from its lesson packages.

Usage: make_copione.py <pkg_dir> <out.md>
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import package

pkg, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
lines = ["# Copione di registrazione", "",
         "Il testo di ogni lezione è diviso per slide: registra una traccia per slide, nello stesso ordine. "
         "Il testo è una traccia fedele ai contenuti del manuale: puoi riformulare con parole tue, "
         "purché numeri, norme ed esempi restino quelli indicati.", ""]
for f in sorted(pkg.glob("L*.md")):
    meta, slides = package.parse(f)
    words = sum(len(t.split()) for _, _, t in slides)
    lines += [f"## Lezione {meta.get('lezione')} — {meta.get('titolo')}", "",
              f"*{meta.get('livello', '')} · {len(slides)} slide · {words} parole · circa {round(words / 140)} minuti*", ""]
    for n, _, t in slides:
        lines += [f"### Slide {int(n)}", "", t, ""]
out.write_text("\n".join(lines), encoding="utf-8")
print(out, len(lines))
