"""Assemble final lesson videos from the instructor's recordings.

Usage: assemble_course.py <corsi_dir> <out_dir> <zip> [<zip> ...]
Each zip comes from the recording studio and holds <corso>/L##/s##.webm. For every lesson
touched by the zips: slides are rendered, recordings placed next to them, and an MP4 plus
.srt subtitles are written to <out_dir>/<corso>/. Slides without a recording use the
synthetic preview voice and are listed at the end, so nothing is published by mistake.
"""
import sys, json, zipfile, pathlib, subprocess
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import package, build_video

corsi, out_root = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
lessons = {}
for z in sys.argv[3:]:
    with zipfile.ZipFile(z) as zf:
        for name in zf.namelist():
            parts = pathlib.PurePosixPath(name).parts
            if len(parts) != 3 or not parts[2].endswith(".webm") or ".." in parts:
                continue
            corso, lez, seg = parts
            dest = out_root / corso / "build" / lez / "audio" / seg
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(zf.read(name))
            lessons.setdefault(corso, set()).add(lez)

missing = []
for corso, lezs in sorted(lessons.items()):
    pkg_dir = corsi / corso / "pacchetti"
    tmp_pkg = out_root / corso / "_pkg"
    tmp_pkg.mkdir(parents=True, exist_ok=True)
    for lez in lezs:
        (tmp_pkg / f"{lez}.md").write_text((pkg_dir / f"{lez}.md").read_text(encoding="utf-8"), encoding="utf-8")
    package.main(tmp_pkg, out_root / corso / "build")
    for lez in sorted(lezs):
        mpath = out_root / corso / "build" / lez / "manifest.json"
        m = json.loads(mpath.read_text(encoding="utf-8"))
        missing += [f"{corso}/{lez}/{pathlib.Path(s['slide']).stem}" for s in m["segments"] if not s.get("audio")]
        mp4, secs = build_video.build(mpath)
        final = out_root / corso / f"{corso}-{lez}.mp4"
        mp4.replace(final)
        mp4.with_suffix(".srt").replace(final.with_suffix(".srt"))
        print(f"{final}  {secs/60:.1f} min")
if missing:
    print("\nATTENZIONE — slide senza registrazione (usata voce sintetica):")
    print("\n".join(missing))
