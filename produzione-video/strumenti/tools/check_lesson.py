"""Render one lesson package and report slides whose content overflows the safe area.

Usage: check_lesson.py <L##.md> [<png_out_dir>]
Prints one OVERFLOW line per problem slide (content below y=960px) and the PNG paths,
so you can open a PNG with your image-reading tool to look at it.
"""
import sys, pathlib, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import package, render_slides

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(tempfile.mkdtemp()) / src.stem
out.mkdir(parents=True, exist_ok=True)
meta, slides = package.parse(src)
jobs = []
for n, sec, _ in slides:
    (out / f"s{n}.html").write_text(sec, encoding="utf-8")
    jobs.append((str(out / f"s{n}.html"), str(out / f"s{n}.png")))
render_slides.render(jobs)
print(f"{len(slides)} slide renderizzate in {out}")
