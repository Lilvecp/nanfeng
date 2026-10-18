# Demo video pipeline (deliverable 03)

Builds the NanFeng demo video from the script in [video-script.md](../video-script.md), reworked after a reviewer's feedback. The product is recorded in one take on the live site,
www.nanfengcfo.com. The voice, the EN + 中文 subtitles, the zooms, the chapter rail, the rubric
chips and the title cards are composited in Remotion. Running it again gives the same video, so a
change to the app or to a line only needs another run.

| Step | Tool | Output |
|---|---|---|
| Voice | ElevenLabs, the team's chosen voice, `eleven_multilingual_v2` at speed 0.9 (`tts/tts.mjs`), one clip per subtitle line, stitched to its neighbours. Key and voice ID in `.env` (git-ignored). `tts/check.py` transcribes it back with Whisper to catch mispronounced words. Free fallback: `tts/edge.py` (Microsoft neural voice) | `public/audio/` |
| Timeline | `plan.mjs`: when each line starts in its scene and how long each scene runs | `src/timeline.json` |
| Recording | Playwright + Chrome on the GPU (Vulkan), CDP screencast at 60 fps, 1600×900 at 1.5× pixel density, clicks timed to the voice (`record/`) | `public/rec/sNN.mp4` |
| Edit | Remotion (`src/`): zooms, spotlight, subtitles, chapter rail, chips, callouts, crossfades, title cards | `out/` (work files) |
| Finish | ffmpeg: loudness −16 LUFS, H.264 1080p, length check ≤ 5:00 | The submitted pitch cut (3:25), [`03-demo-video/nanfeng-demo.mp4`](../../nanfeng-demo.mp4); the full 5-minute cut in `out/` |

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
node record/record.mjs                  # the live take of the full cut (resets the public sandbox once)
node record/record.mjs --pitch          # the pitch cut's take on the scenario's clock (resets it again)
./make.sh pitch                         # the submitted pitch cut: ../../nanfeng-demo.mp4 and ../../transcript.md
./make.sh render                        # the full 5-minute cut: out/nanfeng-demo-full.mp4 (SHORT=1 adds a 2:30 cut)
```

- Changing the voice or a line changes the timeline: record the take again after it.
- `node record/record.mjs --dry s05` runs the clicks without recording and saves screenshots
  (`public/rec/.dry-*`). Dry runs never reset the sandbox, upload or approve.
- `npm run studio` opens Remotion Studio to preview and adjust the edit.
- Not in git (too large, or local only): the recorded take `public/rec/` (about 400 MB), earlier
  renders and phone copies in `out/`, `node_modules/`, `.venv-tts/` and `.env`. A fresh clone
  renders again after `node record/record.mjs`; the voice clips in `public/audio/` are committed.

## The pitch cut (the submitted video)

A reviewer's second pass (2026-10-16) asked for a 3-minute version: a jury that watches dozens of
projects sees 3 minutes through, and stops a 5-minute one halfway. `./make.sh pitch` builds it and
writes the video and its [transcript](../../transcript.md) to the top of the deliverable folder.

A third pass (same day) asked for one clock with the deck (the letter at 10:12, the approval at
10:15), nothing on screen ahead of the letter, the Business health screen and the owner's WhatsApp,
and the claims as the deck words them. The cut now has its own take, `node record/record.mjs
--pitch`: one sandbox reset, then only the scenes the cut shows, in its order, plus three of its own
(`p02` Demo Mode before the notice, `p04` Business health, `p06` the owner's WhatsApp thread). The
recorder picks the next moment when it is 10:12 in some time zone, sets the browser to that zone,
and holds the scene clock (nothing is recorded) until the letter goes to the agent at 10:12 and
again until the owner approves at 10:15. Clips are encoded after the take. Like the full take, it
resets the public sandbox and sends a Sepolia transaction. During it the browser's own
`POST /approvals` gets a 403: an owner's desk with no request pending opens the Cherry Crisis
request itself (`web/src/lib/desk-state.tsx`), so without this the request would be in the audit log
before the letter. The only request is the one the live agent proposes after reading the letter.

| Piece | What it does |
|---|---|
| [`pitch.mjs`](pitch.mjs) | The cut: which pieces of which recorded scene play, which narration line plays where, and the motion-graphics sections. `node pitch.mjs` prints the timeline, its length and every pause between two lines longer than 1.2 s |
| [`tts/pitch-voice.mjs`](tts/pitch-voice.mjs) | The narration: every line of the cut in the team's voice on ElevenLabs `eleven_v3`, with a delivery direction per line (`VOICE_V3` in `pitch.mjs`: worried, excited, firm, proud…) in `public/audio/pitch/v3/`, and the speech span of every clip. The earlier `eleven_multilingual_v2` takes stay in `public/audio/` as the fallback |
| [`src/pitch/`](src/pitch/) | The composition `NanFengPitch`: app shots (`Shot.tsx`, the recorder's zooms and callouts on the scene's own clock), the problem, results and team scenes, the title cards |
| [`assets/cutouts.py`](assets/cutouts.py) | Team portraits without their backgrounds (MODNet, run locally), so the sign behind Vicente's photo is gone |
| [`tts/sfx.mjs`](tts/sfx.mjs) | A small synthesised sound kit for the motion graphics (whoosh, pop, tick); `REMOTION_SFX=0` renders without it |
| [`tts/music.py`](tts/music.py) | The music bed, synthesised for this timeline: a chill lo-fi groove (80 BPM with a swing, rootless jazz chords on a Rhodes-like electric piano, a walking bass, soft muffled drums, a little vinyl crackle). The drums drop out under the tagline and on the end card; the bed is ducked about 16 dB under every narration line and fills every pause. Cached until the timeline or the score changes; `REMOTION_MUSIC=0` renders without it |
| [`stills.mjs`](stills.mjs) | Single frames or a frame every N seconds, to check the picture before a full render |
| [`check-render.py`](check-render.py) | Checks a finished render: length, loudness, silences over 1.2 s, frozen picture, and what Whisper hears against the script |

```sh
node tts/pitch-voice.mjs                      # only voices what is new or changed
node pitch.mjs                                # the timeline and its pauses
node stills.mjs NanFengPitch out/check --every 3
./make.sh pitch                               # ../../nanfeng-demo.mp4
.venv-tts/bin/python check-render.py ../../nanfeng-demo.mp4 src/pitch.json   # what a viewer sees and hears
```

Choices in the cut:

- **Story.** Problem (and Demo Mode's first step: the morning before NanFeng acts) → risk spotted
  (the live run, the verdict, Business health) → best deal (the options, the owner's WhatsApp thread,
  the live "why") → you approve (10:15, three minutes after the letter) → on-chain proof → fraud
  blocked → built for China → results and team. Left out: the stress test, the code-by-SMS line (the
  callout on screen says it) and the names in the narration (they are on the team cards).
- **Claims as the deck words them.** An AI CFO that acts with the owner's approval; a tamper-evident
  audit log; quarantined before any language model reads it; WeCom simulated in this demo; −41% on the
  25 benchmark cases that needed financing; our own red team. The WhatsApp thread is the Messages
  page's, labelled "Recorded replay · not a live chat" on screen: no real WhatsApp goes out from the
  public demo.
- **No dead air.** Lines are packed on their speech, not on the silence a take ends with; app pieces
  cut inside the pauses between sentences, and a page that is still loading is cut out. The two
  pauses over 1.2 s are on purpose: NanFeng taking the empty finance seat, and the tagline landing.
- **Cuts.** A new page opens with a short blink (a crossfade showed two pages at once); a cut on the
  same page carries the camera across and eases into the next zoom.
- **Voice and music.** After the third review the narration was voiced again on ElevenLabs v3 with a
  direction per line, for more energy and emotion (it measures 4–9 dB more loudness range than the v2
  takes), and checked back with Whisper (three lines were voiced again with another seed: an added
  word, "NanFeng" misread, a dropped "-ed"). A chill lo-fi bed, ducked under the voice, fills every
  pause between lines.
- **The tagline** is the deck's: "NanFeng doesn't advise. It acts, with your permission." Its
  Chinese line (南风不止于建议。它在您的授权下行动。) is machine-assisted, like the other subtitles.
- **The end card** has no repository link while the repository is private.

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
