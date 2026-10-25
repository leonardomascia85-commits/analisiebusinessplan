"""Produce i video di un corso con voce sintetica. Riprende da dove si era fermato.

Uso: produci_corso.py <corsi_dir> <corso> <out_dir> [lezioni N M ...]
"""
import sys, json, pathlib, shutil
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import package, build_video

corsi, corso, out = pathlib.Path(sys.argv[1]), sys.argv[2], pathlib.Path(sys.argv[3])
only = {f"L{int(x):02}" for x in sys.argv[4:]}
pk = corsi / corso / "pacchetti"
dest = out / corso
dest.mkdir(parents=True, exist_ok=True)
for f in sorted(pk.glob("L*.md")):
    lez = f.stem
    if only and lez not in only:
        continue
    final = dest / f"{corso}-{lez}.mp4"
    if final.exists():
        continue
    tmp = out / "_work" / corso / lez
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "pkg").mkdir(parents=True)
    shutil.copy(f, tmp / "pkg" / f.name)
    package.main(tmp / "pkg", tmp / "build")
    mp4, secs = build_video.build(tmp / "build" / lez / "manifest.json")
    mp4.with_suffix(".srt").replace(dest / f"{corso}-{lez}.srt")
    mp4.replace(final)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{corso} {lez} {secs/60:.1f} min", flush=True)
