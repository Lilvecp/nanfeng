"""Checks a finished render: length, loudness, silences, frozen picture, and what a listener hears against
the script (Whisper medium). Usage: .venv-tts/bin/python check-render.py ../../nanfeng-demo.mp4 src/pitch.json"""
import json, re, subprocess, sys, difflib
import numpy as np

video, pitch_file = sys.argv[1], sys.argv[2]
pitch = json.load(open(pitch_file))
run = lambda a: subprocess.run(a, capture_output=True, text=True)
dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).stdout)
print(f"duration {dur:.2f} s ({int(dur // 60)}:{dur % 60:04.1f})")
eb = run(["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
print("loudness", re.findall(r"I:\s+(-?[\d.]+) LUFS", eb)[-1], "LUFS; true peak", re.findall(r"Peak:\s+(-?[\d.]+) dBFS", eb)[-1], "dBTP")
sd = run(["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-af", "silencedetect=noise=-40dB:d=1.2", "-f", "null", "-"]).stderr
sil = list(zip(re.findall(r"silence_start: ([\d.]+)", sd), re.findall(r"silence_duration: ([\d.]+)", sd)))
print("silences ≥ 1.2 s:", ", ".join(f"{float(a):.1f}s ({float(b):.2f}s)" for a, b in sil) or "none")
fz = run(["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-vf", "scale=480:-1,freezedetect=n=0.002:d=2.0", "-map", "0:v", "-f", "null", "-"]).stderr
fr = list(zip(re.findall(r"freeze_start: ([\d.]+)", fz), re.findall(r"freeze_duration: ([\d.]+)", fz)))
print("still picture ≥ 2 s:", ", ".join(f"{float(a):.1f}s ({float(b):.2f}s)" for a, b in fr) or "none")

from faster_whisper import WhisperModel
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
y = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
m = WhisperModel("medium", device="cpu", compute_type="int8")
segs, _ = m.transcribe(y, beam_size=5, language="en", word_timestamps=True, vad_filter=False)
heard = [w for s in segs for w in s.words]
norm = lambda t: re.sub(r"[^a-z0-9%]+", " ", t.lower()).split()
expected = norm(" ".join(l["en"] for s in pitch["sections"] for l in s["lines"]))
got = norm(" ".join(w.word for w in heard))
print(f"words: script {len(expected)}, heard {len(got)}")
sm = difflib.SequenceMatcher(a=expected, b=got, autojunk=False)
for op, a0, a1, b0, b1 in sm.get_opcodes():
    if op != "equal":
        print(f"  {op:8s} script: {' '.join(expected[a0:a1])!r:60s} heard: {' '.join(got[b0:b1])!r}")
print("Sepolia heard as:", [w.word.strip() for w in heard if "pol" in w.word.lower()])
