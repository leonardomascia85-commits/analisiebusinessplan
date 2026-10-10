"""Assemble a lesson video from (slide PNG, narration text) segments.

Manifest JSON: {"voice": "...", "rate": "+0%", "output": "x.mp4",
                "segments": [{"slide": "a.png", "text": "...", "audio": optional wav}]}
A segment with "audio" uses that recording instead of synthetic speech, so the same
manifest assembles the final video once the instructor's voice is recorded.
Writes <output>.mp4 and <output>.srt.
"""
import asyncio, json, re, subprocess, sys, wave, pathlib
import edge_tts, imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
FADE = 0.5
GAP = 0.6
PAUSE_RE = re.compile(r"\[pausa[^\]]*\]", re.I)
STAGE_RE = re.compile(r"\[[^\]]*\]")


def clean(text):
    text = PAUSE_RE.sub(" … ", text)
    text = STAGE_RE.sub(" ", text)
    text = text.replace("**", "").replace("*", "")
    return re.sub(r"\s+", " ", text).strip()


def run(*args):
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


async def tts(text, voice, rate, mp3):
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="SentenceBoundary")
    cues = []
    with open(mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                cues.append((chunk["offset"] / 1e7, (chunk["offset"] + chunk["duration"]) / 1e7, chunk["text"]))
    return cues


def wav_seconds(path):
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def wrap(text, width=42):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    out = []
    for i in range(0, len(lines), 2):
        out.append("\n".join(lines[i:i + 2]))
    return out


def build(manifest_path):
    m = json.loads(pathlib.Path(manifest_path).read_text())
    base = pathlib.Path(manifest_path).parent
    out = base / m["output"]
    work = out.with_suffix("")
    work = work.parent / (work.name + "_work")
    work.mkdir(exist_ok=True)
    voice, rate = m.get("voice", "it-IT-DiegoNeural"), m.get("rate", "+0%")

    seg_wavs, seg_durs, all_cues, t0 = [], [], [], 0.0
    for i, seg in enumerate(m["segments"]):
        wav = work / f"s{i:03}.wav"
        if seg.get("audio"):
            run("-i", str(base / seg["audio"]), "-ac", "1", "-ar", "48000", str(wav))
            cues = []
        else:
            mp3 = work / f"s{i:03}.mp3"
            cues = asyncio.run(tts(clean(seg["text"]), voice, rate, mp3))
            run("-i", str(mp3), "-ac", "1", "-ar", "48000", "-af", "apad=pad_dur=%.2f" % GAP, str(wav))
        d = wav_seconds(wav)
        if not cues:
            sents = [x for x in re.split(r"(?<=[.!?…])\s+", clean(seg["text"])) if x]
            total = sum(len(x) for x in sents) or 1
            span, t = max(0.1, d - 0.4), 0.2
            for x in sents:
                dt = span * len(x) / total
                cues.append((t, t + dt, x))
                t += dt
        seg_wavs.append(wav)
        seg_durs.append(d)
        for s, e, txt in cues:
            parts = wrap(txt)
            span = (e - s) / len(parts)
            for k, p in enumerate(parts):
                all_cues.append((t0 + s + k * span, t0 + s + (k + 1) * span, p))
        t0 += d

    # audio track
    lst = work / "audio.txt"
    lst.write_text("".join(f"file '{w.name}'\n" for w in seg_wavs))
    audio = work / "narration.wav"
    run("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(audio))

    # video: one encoded clip per still (cheap for static frames), short fades, then concat
    clips = []
    for i, (seg, d) in enumerate(zip(m["segments"], seg_durs)):
        clip = work / f"v{i:03}.mp4"
        fo = max(0.0, d - FADE / 2)
        run("-loop", "1", "-framerate", "30", "-t", f"{d:.3f}", "-i", str(base / seg["slide"]),
            "-vf", f"fade=t=in:st=0:d={FADE/2},fade=t=out:st={fo:.3f}:d={FADE/2},format=yuv420p",
            "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "22", "-r", "30", str(clip))
        clips.append(clip)
    vlist = work / "video.txt"
    vlist.write_text("".join(f"file '{c.name}'\n" for c in clips))
    run("-f", "concat", "-safe", "0", "-i", str(vlist), "-i", str(audio), "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-shortest", str(out))

    srt = out.with_suffix(".srt")
    srt.write_text("".join(f"{k}\n{srt_time(s)} --> {srt_time(e)}\n{t}\n\n"
                           for k, (s, e, t) in enumerate(all_cues, 1)), encoding="utf-8")
    return out, sum(seg_durs)


if __name__ == "__main__":
    for mp in sys.argv[1:]:
        o, secs = build(mp)
        print(f"{o} {secs/60:.1f} min")
