"""Regenerate script-video/<course>.md (narration only) from the lesson packages."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import package
pkg, out, title, guide = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3], sys.argv[4]
files = sorted(pkg.glob("L*.md"))
lines = [f"# Script Video — {title}", f"**Guida sorgente**: {guide} · {len(files)} lezioni",
         "", "Ogni paragrafo corrisponde a una slide del video (vedi i pacchetti di produzione con le slide).", "", "---", ""]
for f in files:
    meta, slides = package.parse(f)
    lines += [f"## Lezione {meta['lezione']} — {meta['titolo']}", ""]
    for _, _, t in slides:
        lines += [t, ""]
    lines += ["---", ""]
out.write_text("\n".join(lines), encoding="utf-8")
print(out, sum(len(t.split()) for t in lines))
