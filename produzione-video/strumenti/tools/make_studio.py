"""Build the offline recording studio for one course.

Usage: make_studio.py <course_slug> "<Course name>" <built_dir> <out.html>
<built_dir> holds L<NN>/manifest.json and sNN.png as produced by package.py.
"""
import base64, io, json, sys, pathlib
from PIL import Image

TEMPLATE = pathlib.Path(__file__).with_name("studio_template.html")


def thumb(png):
    im = Image.open(png).convert("RGB")
    im.thumbnail((800, 450))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=70, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main(slug, course, built, out):
    built = pathlib.Path(built)
    lessons = []
    for d in sorted(p for p in built.iterdir() if p.is_dir() and p.name.startswith("L")):
        m = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
        segs = [{"id": pathlib.Path(s["slide"]).stem, "text": s["text"], "thumb": thumb(d / s["slide"])}
                for s in m["segments"]]
        lessons.append({"id": d.name, "n": m["meta"].get("lezione", d.name[1:]),
                        "title": m["meta"].get("titolo", ""), "segments": segs})
    data = json.dumps({"slug": slug, "course": course, "lessons": lessons}, ensure_ascii=False)
    data = data.replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("__COURSE__", course).replace("__DATA__", data)
    pathlib.Path(out).write_text(html, encoding="utf-8")
    print(out, f"{len(lessons)} lezioni", f"{pathlib.Path(out).stat().st_size/1e6:.1f} MB")


if __name__ == "__main__":
    main(*sys.argv[1:])
