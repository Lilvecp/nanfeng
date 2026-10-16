"""English narration with Microsoft neural voices (edge-tts), no API key needed.

Same output as tts.mjs (the ElevenLabs version): public/audio/sNN-LL.mp3, one clip per subtitle
line with the silence trimmed, and public/audio/timing.json with the length of each line.
Switching back to ElevenLabs later is `node tts/tts.mjs --force`.

Usage: .venv-tts/bin/python tts/edge.py [--force] [--voice en-US-AndrewMultilingualNeural]
"""
import argparse
import asyncio
import hashlib
import json
import pathlib
import subprocess

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"

# Words the voice reads better spelled differently (subtitles keep the original).
# Checked by transcribing the voice back with Whisper (tts/check.py): the plain spellings came back
# as "Weirdo Ostril", "nanphone" and "Renato Linus".
SAY = {
    "Huerto Austral": "Hwer-toh Ows-trahl",
    "nanfengcfo.com": "Nan-fung C F O dot com",
    "NanFeng": "Nan-fung",
    "Lenis": "Lennis",
    "Bufadel": "Boo-fah-dell",
}


def lines():
    """The narration lines from scenes.mjs, read through node so there is one source of truth."""
    js = "import('./scenes.mjs').then(m => console.log(JSON.stringify(m.SCENES.map(s => ({id: s.id, says: s.lines.map(l => l.say)})))))"
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))


def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).decode().strip())


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="en-US-AndrewMultilingualNeural")
    ap.add_argument("--rate", default="-4%")  # a touch slower than default: judges read two subtitle lines
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    timing_file = OUT / "timing.json"
    timing = json.loads(timing_file.read_text()) if timing_file.exists() else {}
    for scene in lines():
        for i, say in enumerate(scene["says"]):
            text = say
            for k, v in SAY.items():
                text = text.replace(k, v)
            name = f"{scene['id']}-{i + 1:02d}"
            mp3 = OUT / f"{name}.mp3"
            h = hashlib.sha1(f"edge|{a.voice}|{a.rate}|{text}".encode()).hexdigest()[:12]
            prev = (timing.get(scene["id"]) or [None] * 99)[i] if i < len(timing.get(scene["id"], [])) else None
            if not a.force and prev and prev.get("hash") == h and mp3.exists():
                continue
            raw = OUT / f"{name}.raw.mp3"
            for attempt in range(4):
                try:
                    await edge_tts.Communicate(text, a.voice, rate=a.rate).save(str(raw))
                    break
                except Exception:  # transient network errors
                    if attempt == 3:
                        raise
                    await asyncio.sleep(2 * (attempt + 1))
            # Trim leading/trailing silence so the timeline controls every pause; light polish:
            # high-pass the rumble, gentle compression, re-encode at 192k.
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af",
                            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,"
                            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,"
                            "highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2",
                            "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True)
            raw.unlink()
            d = round(duration(mp3), 3)
            timing.setdefault(scene["id"], [])
            while len(timing[scene["id"]]) <= i:
                timing[scene["id"]].append(None)
            timing[scene["id"]][i] = {"dur": d, "hash": h}
            timing_file.write_text(json.dumps(timing, indent=2))
            print(f"{name}  {d:5.2f}s  {say[:60]}")


asyncio.run(main())
