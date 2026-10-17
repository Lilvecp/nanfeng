"""Music bed for the pitch cut: a chill lo-fi groove, synthesised here (the ElevenLabs key has no music
permission, and no third-party music or samples are used).

Reads the cut's timeline (src/pitch.json) and writes public/audio/pitch/music.wav, as long as the cut:
80 BPM with a swing, rootless jazz chords on a Rhodes-like electric piano (Dm9 G13 Cmaj9 Am9, then
Fmaj9 Em7 Dm9 Cmaj7), a walking bass, soft muffled drums and a little vinyl crackle, all through a
warm low-pass. The drums stay out on the opening card, drop out under the tagline so it lands, and
stop for the end card while the last chord rings out. The bed is ducked about 16 dB under every
narration line, so the voice always leads and no pause between two lines is silent.

Run with the pipeline's venv (numpy):  .venv-tts/bin/python tts/music.py [--force]
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/audio/pitch/music.wav"
# same timeline and same score: same file (fixed seed); the key says what it was made from
KEY = hashlib.sha1((ROOT / "src/pitch.json").read_bytes() + Path(__file__).read_bytes()).hexdigest()[:16]
key_file = OUT.with_suffix(".key")
if OUT.exists() and key_file.exists() and key_file.read_text().strip() == KEY and "--force" not in sys.argv:
    print(f"{OUT.relative_to(ROOT)} unchanged")
    sys.exit(0)

SR = 48000
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT
SWING = 0.6  # the off-beat eighth lands at 60% of the beat
rng = np.random.default_rng(7)

pitch = json.loads((ROOT / "src/pitch.json").read_text())
TOTAL = pitch["total"]
N = int(TOTAL * SR) + 1
sections = pitch["sections"]
sec = {s["id"]: s for s in sections}

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def midi(name: str, octave: int) -> int:
    return NOTE[name] + 12 * (octave + 1)


# rootless voicings (semitones above the root); the bass plays the root
VOICING = {
    "m9": [3, 7, 10, 14], "13": [4, 10, 14, 21], "maj9": [4, 7, 11, 14], "m7": [3, 7, 10, 15], "maj7": [4, 7, 11, 16],
}
PROGS = [
    [("D", "m9"), ("G", "13"), ("C", "maj9"), ("A", "m9")],
    [("F", "maj9"), ("E", "m7"), ("D", "m9"), ("C", "maj7")],
]


def chord(bar: int):
    return PROGS[(bar // 8) % 2][bar % 4]


def swung(beat_pos: float) -> float:
    """Beat position (in beats, eighths as .5) to seconds, with the off-beat eighths swung."""
    whole = int(beat_pos)
    frac = beat_pos - whole
    return (whole + (SWING if abs(frac - 0.5) < 1e-6 else frac)) * BEAT


def place(buf: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(round(at * SR))
    if i >= len(buf) or i + len(x) <= 0:
        return
    a = max(0, -i)
    j = min(len(buf), i + len(x))
    buf[max(0, i):j] += gain * x[a: j - i]


def fft_filter(x: np.ndarray, lo: float | None = None, hi: float | None = None, order: float = 2.0) -> np.ndarray:
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    if hi:
        X *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        X *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X, len(x)).astype(np.float32)


# ---- instruments (each note is computed once and reused) ----
@lru_cache(maxsize=None)
def rhodes(m: int, dur: float) -> np.ndarray:
    """A Rhodes-like tine: FM with a fast-decaying index (the bell), a soft second partial, tremolo."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    index = 0.25 + 1.4 * np.exp(-t / 0.08)
    x = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t)) + 0.18 * np.sin(2 * np.pi * 2 * f * t)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 1.6)
    env[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * t)
    return (x * env * trem).astype(np.float32)


@lru_cache(maxsize=None)
def pad_note(m: int, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.003 * f * t) + 0.12 * np.sin(2 * np.pi * 3.001 * f * t)
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 0.9)
    return (x * np.clip(env, 0, 1)).astype(np.float32)


@lru_cache(maxsize=None)
def bass_note(m: int, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = np.tanh(1.3 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)))
    env = np.minimum(1, t / 0.008) * np.exp(-t / 0.9)
    env[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return (x * env).astype(np.float32)


def kick_sample() -> np.ndarray:
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 52 * np.exp(-t / 0.035)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)).astype(np.float32)


def snare_sample() -> np.ndarray:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = fft_filter(rng.standard_normal(n).astype(np.float32), lo=900, hi=3800) * np.exp(-t / 0.07)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.045)
    return (0.75 * noise + 0.5 * body).astype(np.float32)


def hat_sample() -> np.ndarray:
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return (fft_filter(rng.standard_normal(n).astype(np.float32), lo=6500, hi=11000) * np.exp(-t / 0.018)).astype(np.float32)


KICK, SNARE, HAT = kick_sample(), snare_sample(), hat_sample()

# ---- where the drums play: not on the opening card, not under the tagline, not on the end card ----
res = sec["results"]
tag_a = res["start"] + res["lines"][1]["start"]
tag_b_end = res["start"] + res["lines"][2]["end"]
no_drums = [(0, sec["problem"]["start"] + 0.2), (tag_a - 0.25, tag_b_end + 0.35), (sec["end"]["start"], TOTAL + 1)]


def drums_on(t: float) -> bool:
    return not any(a <= t < b for a, b in no_drums)


# ---- the score ----
keys = np.zeros(N, np.float32)
pad = np.zeros(N, np.float32)
bass = np.zeros(N, np.float32)
drums = np.zeros(N, np.float32)
end0 = sec["end"]["start"]
bars = int(np.ceil(end0 / BAR))
for b in range(bars):
    b0 = b * BAR
    root, q = chord(b)
    nxt_root, _ = chord(b + 1)
    r = midi(root, 3)
    notes = [r + iv for iv in VOICING[q]]
    while min(notes) < midi("E", 3):
        notes = [n + 12 for n in notes]
    while max(notes) > midi("A", 5):
        notes = [n - 12 for n in notes]
    # comping: a chord on beat 1 and a lighter one on the swung "and" of 2, rolled a little
    for pos, dur, vel in ((0, 1.6 * BEAT, 1.0), (1.5, 2.2 * BEAT, 0.7)):
        for k, m in enumerate(notes):
            v = vel * (0.9 + 0.2 * rng.random())
            place(keys, rhodes(m, round(dur, 3)), b0 + swung(pos) + 0.012 * k, 0.11 * v)
    for m in notes[:3]:
        place(pad, pad_note(m, round(BAR + 0.6, 3)), b0 - 0.1, 0.035)
    # walking bass: root, fifth, and an approach note into the next bar
    bm = midi(root, 2) if midi(root, 2) >= midi("E", 2) else midi(root, 3)
    nm = midi(nxt_root, 2) if midi(nxt_root, 2) >= midi("E", 2) else midi(nxt_root, 3)
    fifth = bm + 7 if bm + 7 <= midi("D", 3) else bm - 5
    for pos, m, dur, vel in ((0, bm, 1.7, 1.0), (2, fifth, 1.2, 0.8), (3.5, nm - 1, 0.45, 0.6)):
        place(bass, bass_note(m, round(dur * BEAT, 3)), b0 + swung(pos), 0.2 * vel)
    # drums: kick on 1 and the "and" of 2, snare on 2 and 4, swung hats
    for beat in range(4):
        t = b0 + beat * BEAT
        if drums_on(t):
            if beat == 0:
                place(drums, KICK, t, 0.55)
            if beat in (1, 3):
                place(drums, SNARE, t, 0.16)
        for half in (0, 0.5):
            th = b0 + swung(beat + half)
            if drums_on(th):
                place(drums, HAT, th, 0.035 if half == 0 else 0.022)
    if drums_on(b0 + swung(1.5)):
        place(drums, KICK, b0 + swung(1.5), 0.4)

# the last chord (Cmaj9) rings out over the end card
for m in [midi("C", 3) + iv for iv in VOICING["maj9"]]:
    place(keys, rhodes(m, 3.2), end0 + 0.05, 0.1)
place(bass, bass_note(midi("C", 2), 2.5), end0 + 0.05, 0.18)

# vinyl: sparse soft crackle
crackle = np.zeros(N, np.float32)
for at in np.cumsum(rng.exponential(1 / 5.0, int(TOTAL * 6))):
    if at >= TOTAL:
        break
    n = int(rng.integers(20, 90))
    place(crackle, (rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 4))).astype(np.float32), at, 0.012 * rng.random())
crackle = fft_filter(crackle, lo=1200, hi=7000)

keys = fft_filter(keys, hi=5200)
pad = fft_filter(pad, hi=1400)
bass = fft_filter(bass, hi=700)
drums = fft_filter(drums, hi=5500)
mix = keys + pad + bass + drums + crackle


def room(x: np.ndarray, seconds: float = 1.3, wet: float = 0.2) -> np.ndarray:
    n = int(seconds * SR)
    ir = (rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * seconds / 6.5))).astype(np.float32)
    ir = fft_filter(ir, hi=4500)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)].astype(np.float32)
    return (1 - wet) * x + wet * y


mix = room(mix)
mix = np.tanh(1.2 * mix / max(1e-6, np.max(np.abs(mix)))).astype(np.float32)  # tape-like warmth
mix = fft_filter(mix, hi=7000)

# ---- ducking under the narration: attack 80 ms, release 300 ms, about -16 dB ----
speech = np.zeros(N, np.float32)
for s in sections:
    for l in s["lines"]:
        a, b = s["start"] + l["start"], s["start"] + l["end"]
        speech[max(0, int((a - 0.12) * SR)): min(N, int((b + 0.25) * SR))] = 1
duck = np.zeros(N, np.float32)
level, blk = 0.0, 240
up, down = blk / (0.08 * SR), blk / (0.3 * SR)
for i in range(0, N, blk):
    target = speech[i]
    level = min(target, level + up) if target > level else max(target, level - down)
    duck[i:i + blk] = level
gain = 1.0 - 0.85 * duck

fade = np.ones(N, np.float32)
fade[: int(0.8 * SR)] = np.linspace(0, 1, int(0.8 * SR))
tail = int(1.2 * SR)
fade[-tail:] *= np.linspace(1, 0, tail) ** 1.5
mix = mix * gain * fade

mix /= max(1e-6, np.max(np.abs(mix)))
mix *= 0.19  # about 18 dB under the voice during a line, 6 dB between lines: in the background
d = int(0.011 * SR)
stereo = np.stack([mix, np.concatenate([np.zeros(d, np.float32), mix[:-d]])], axis=1)  # a little width
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(stereo, -1, 1) * 32767).astype(np.int16).tobytes())
key_file.write_text(KEY + "\n")
err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(OUT), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
print(f"{OUT.relative_to(ROOT)}  {TOTAL:.1f} s  {lufs[-1] if lufs else '?'} LUFS")
