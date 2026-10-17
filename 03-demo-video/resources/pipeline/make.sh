#!/usr/bin/env bash
# Builds the demo video end to end: voice → recording → timeline → render → loudness → checks.
# Usage: ./make.sh            full pipeline: voice, one live take on www.nanfengcfo.com, both cuts
#        ./make.sh pitch      only the submitted pitch cut (pitch.mjs), after editing src/pitch/ or pitch.mjs
#                             (its own take: node record/record.mjs --pitch, clips in public/rec/pitch/)
#        ./make.sh render     only the full 5-minute cut (after editing src/ or re-recording)
#        SHORT=1 ./make.sh render   also the 2:30 cut
# The submitted video is the pitch cut, at the top of the deliverable folder: 03-demo-video/nanfeng-demo.mp4
# (PITCH_OUT=<file> writes it elsewhere). The full cut goes to out/nanfeng-demo-full.mp4.
set -euo pipefail
cd "$(dirname "$0")"

STEP="${1:-all}"
if [ "$STEP" = "all" ]; then
  node tts/tts.mjs
  node tts/polish.mjs
  node record/record.mjs
  node record/record.mjs --pitch
fi

mkdir -p out
render() { # composition output [destination, default out/<output>.mp4]
  local dst="${3:-out/$2.mp4}"
  npx remotion render src/index.ts "$1" "out/.raw-$2.mp4" --log=error
  # Loudness for online review: -16 LUFS integrated, -1.5 dBTP; video stream copied untouched.
  ffmpeg -y -loglevel error -i "out/.raw-$2.mp4" -c:v copy \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$dst"
  rm -f "out/.raw-$2.mp4"
  local d; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dst")
  printf '%s  %.1f s  %s\n' "$dst" "$d" "$(du -h "$dst" | cut -f1)"
  awk -v d="$d" 'BEGIN { if (d > 300) { print "FAIL: longer than 5:00"; exit 1 } else print "OK: " int(d/60) ":" sprintf("%02d", d%60) " (limit 5:00)" }'
}

if [ "$STEP" = "all" ] || [ "$STEP" = "render" ]; then
  node plan.mjs --write
  render NanFengDemo nanfeng-demo-full
  [ "${SHORT:-0}" = 1 ] && render NanFengDemoShort nanfeng-demo-short
fi
if [ "$STEP" = "all" ] || [ "$STEP" = "pitch" ]; then
  node tts/pitch-voice.mjs
  node tts/sfx.mjs >/dev/null
  node pitch.mjs --write
  render NanFengPitch nanfeng-pitch "${PITCH_OUT:-../../nanfeng-demo.mp4}"
fi
