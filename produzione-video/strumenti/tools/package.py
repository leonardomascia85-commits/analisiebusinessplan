"""Turn lesson packages (L01.md ...) into slide PNGs, video manifests and teleprompter HTML.

Usage: package.py <packages_dir> <out_dir>
For each L<NN>.md writes <out_dir>/L<NN>/sNN.png, manifest.json (synthetic preview voice;
a segment's "audio" is filled in when the instructor's recording for it exists in
<out_dir>/L<NN>/audio/sNN.(wav|webm|mp3|m4a)) and copione.html.
"""
import json, re, sys, pathlib, html
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import render_slides

HEAD_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)
SLIDE_RE = re.compile(r"^=== SLIDE (\d+) ===\n(.*?)\n--- TESTO ---\n(.*?)(?=^=== SLIDE |\Z)", re.S | re.M)


def parse(path):
    txt = path.read_text(encoding="utf-8")
    meta = {}
    m = HEAD_RE.match(txt)
    if m:
        for line in m.group(1).splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    slides = [(n, s.strip(), t.strip()) for n, s, t in SLIDE_RE.findall(txt)]
    return meta, slides


def find_audio(d, n):
    for ext in ("wav", "webm", "mp3", "m4a", "ogg"):
        p = d / "audio" / f"s{n}.{ext}"
        if p.exists():
            return f"audio/s{n}.{ext}"
    return None


def copione_html(meta, slides):
    rows = "".join(
        f'<div class="seg"><img src="s{n}.png"><div class="t"><div class="n">Slide {int(n)}</div>'
        f'<p>{html.escape(t)}</p></div></div>' for n, _, t in slides)
    return f"""<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
body{{font-family:Inter,Arial,sans-serif;margin:24px;color:#0B1120}}
h1{{font-family:Georgia,serif;margin:0 0 4px}} .meta{{color:#64748B;margin-bottom:18px}}
.seg{{display:flex;gap:18px;padding:14px 0;border-top:1px solid #E2E8F0;break-inside:avoid}}
.seg img{{width:300px;height:169px;flex:none;border-radius:6px}}
.n{{font-weight:700;color:#B45309;margin-bottom:6px}} p{{font-size:17px;line-height:1.55;margin:0}}
</style></head><body><h1>Lezione {html.escape(meta.get('lezione',''))} — {html.escape(meta.get('titolo',''))}</h1>
<div class="meta">{html.escape(meta.get('corso',''))} · copione di registrazione · {len(slides)} slide</div>{rows}</body></html>"""


def main(pkg_dir, out_dir, voice="it-IT-DiegoNeural"):
    pkg_dir, out_dir = pathlib.Path(pkg_dir), pathlib.Path(out_dir)
    jobs = []
    for f in sorted(pkg_dir.glob("L*.md")):
        meta, slides = parse(f)
        d = out_dir / f.stem
        d.mkdir(parents=True, exist_ok=True)
        for n, sec, _ in slides:
            (d / f"s{n}.html").write_text(sec, encoding="utf-8")
            jobs += [str(d / f"s{n}.html"), str(d / f"s{n}.png")]
        segs = []
        for n, _, t in slides:
            seg = {"slide": f"s{n}.png", "text": t}
            a = find_audio(d, n)
            if a:
                seg["audio"] = a
            segs.append(seg)
        (d / "manifest.json").write_text(json.dumps(
            {"voice": voice, "rate": "+0%", "output": f"{f.stem}.mp4", "meta": meta, "segments": segs},
            ensure_ascii=False, indent=1), encoding="utf-8")
        (d / "copione.html").write_text(copione_html(meta, slides), encoding="utf-8")
        words = sum(len(t.split()) for _, _, t in slides)
        print(f"{f.stem}: {len(slides)} slide, {words} parole")
    render_slides.render(list(zip(jobs[0::2], jobs[1::2])))


if __name__ == "__main__":
    main(*sys.argv[1:])
