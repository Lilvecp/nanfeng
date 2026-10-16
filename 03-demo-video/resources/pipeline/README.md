# Demo video pipeline (deliverable 03)

Builds the NanFeng demo video from the script in the [FinTechathon kit](../../../07-team-workspace/fintechathon-kit.md) (section 4, "Guion del video
demo"), reworked after a judge's review. The product is recorded in one take on the live site,
www.nanfengcfo.com. The voice, the EN + 中文 subtitles, the zooms, the chapter rail, the rubric
chips and the title cards are composited in Remotion. Running it again gives the same video, so a
change to the app or to a line only needs another run.

| Step | Tool | Output |
|---|---|---|
| Voice | ElevenLabs, the team's chosen voice, `eleven_multilingual_v2` at speed 0.9 (`tts/tts.mjs`), one clip per subtitle line, stitched to its neighbours. Key and voice ID in `.env` (git-ignored). `tts/check.py` transcribes it back with Whisper to catch mispronounced words. Free fallback: `tts/edge.py` (Microsoft neural voice) | `public/audio/` |
| Timeline | `plan.mjs`: when each line starts in its scene and how long each scene runs | `src/timeline.json` |
| Recording | Playwright + Chrome on the GPU (Vulkan), CDP screencast at 60 fps, 1600×900 at 1.5× pixel density, clicks timed to the voice (`record/`) | `public/rec/sNN.mp4` |
| Edit | Remotion (`src/`): zooms, spotlight, subtitles, chapter rail, chips, callouts, crossfades, title cards | `out/` (work files) |
| Finish | ffmpeg: loudness −16 LUFS, H.264 1080p, length check ≤ 5:00 | [`03-demo-video/nanfeng-demo.mp4`](../../nanfeng-demo.mp4) |

## Run it

```sh
cd 03-demo-video/resources/pipeline
npm ci
npx playwright install chromium
python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts faster-whisper
printf 'ELEVENLABS_API_KEY=...\nELEVENLABS_VOICE_ID=...\n' > .env && chmod 600 .env   # never commit it
node tts/tts.mjs                        # voice (node tts/tts.mjs s10-03 voices one line again)
node tts/polish.mjs                     # every line at the same loudness, silence after its last word
.venv-tts/bin/python tts/check.py       # optional: what a listener hears, line by line
node record/make-notice.mjs             # the importer's PDF that scene 3 uploads
node record/record.mjs                  # the live take (resets the public sandbox once)
./make.sh render                        # ../../nanfeng-demo.mp4 (SHORT=1 adds out/nanfeng-demo-short.mp4)
```

- Changing the voice or a line changes the timeline: record the take again after it.
- `node record/record.mjs --dry s05` runs the clicks without recording and saves screenshots
  (`public/rec/.dry-*`). Dry runs never reset the sandbox, upload or approve.
- `npm run studio` opens Remotion Studio to preview and adjust the edit.
- Not in git (too large, or local only): the recorded take `public/rec/` (about 400 MB), earlier
  renders and phone copies in `out/`, `node_modules/`, `.venv-tts/` and `.env`. A fresh clone
  renders again after `node record/record.mjs`; the voice clips in `public/audio/` are committed.

## What the live take does

The take is one browser session on www.nanfengcfo.com, so the clock, the audit log, the event stream
and the on-chain anchor all belong to the same run:

1. It resets the public sandbox once (`POST /bank/reset`, owner session with the demo password).
2. Scene 3 uploads `assets/hongxin-payment-notice.pdf` with "Send a document". The live agent reads
   it and runs (about 40 s, shown at 4× with a badge). Its events are real; the scripted trace on the
   Agent activity page stays dimmed outside the spotlight.
3. Scene 7 asks the live agent "Why did you choose this plan?". The answer is built from that run.
4. Scene 8 approves with the sandbox code `482913` (the live build runs `NANFENG_OTP_MODE=sandbox`).
   Approving sends a Sepolia transaction from the anchor wallet.
5. Scene 10 opens the anchor of the `approval.approved` row on Etherscan and shows its input data.

The browser clock uses a time zone where it is mid-morning at recording time, so the times the app
prints read like the scenario's morning (notice at 10:12).

## Choices

- **Numbers come from the screen.** Every number in the narration is on screen when it is said.
  Scene 4 says "before the notice, that risk was 13%", the figure on the KPI. Scene 6 frames only the
  cherry-price rows, so the 90-day base (83%) does not compete with the 81% of day 19.
- **Pronunciation.** The ElevenLabs voice reads the Spanish names as written; a Spanish transcriber
  (Whisper medium, `es`) hears "Huerto", "Universidad del Desarrollo", "Lenis" and "Villarroel"
  right. An English transcriber always misspells them. Only the URL is respelled for the voice.
- **Cuts.** Scenes that continue on the same page open with a hard cut (`cut: true` in `scenes.mjs`);
  a crossfade there showed two offset copies of the page. The camera and the spotlight carry over the
  cut and ease out (`carryFocus` in `src/zoom.ts`), so the cut reads as one shot. A scene may run up
  to 1.5 s past its recording: the last frame holds.
- **Voice only.** After a change to the voice alone, `AUDIO_ONLY=1 npx remotion render src/index.ts
  NanFengDemo out/.audio.wav --codec=wav` renders the track to remux with the finished picture.
- **中文 subtitles** are machine-assisted. A native speaker must check them before export (kit,
  section 2). They are in `scenes.mjs`.
