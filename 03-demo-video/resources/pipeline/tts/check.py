"""Transcribes every narration clip back with Whisper and prints it next to the subtitle, to catch
words the voice says wrong (names, brands). Usage: .venv-tts/bin/python tts/check.py [s03 s14 ...]"""
import json
import pathlib
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

ROOT = pathlib.Path(__file__).resolve().parent.parent
js = "import('./scenes.mjs').then(m => console.log(JSON.stringify(m.SCENES.map(s => ({id: s.id, en: s.lines.map(l => l.en)})))))"
scenes = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))
only = set(sys.argv[1:])
model = WhisperModel("small.en", device="cpu", compute_type="int8")
for s in scenes:
    if only and s["id"] not in only:
        continue
    for i, en in enumerate(s["en"]):
        mp3 = ROOT / "public" / "audio" / f"{s['id']}-{i + 1:02d}.mp3"
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                             capture_output=True, check=True).stdout
        segs, _ = model.transcribe(np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, beam_size=5, language="en")
        print(f"{mp3.stem}  SUB: {en}\n         HEARD: {' '.join(x.text.strip() for x in segs)}")
