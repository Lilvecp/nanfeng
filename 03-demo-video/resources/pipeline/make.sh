#!/usr/bin/env bash
# Builds the demo video end to end: voice → recording → timeline → render → loudness → checks.
# Usage: ./make.sh            full pipeline: voice, one live take on www.nanfengcfo.com, render
#        ./make.sh render     only render + finish (after editing src/ or re-recording)
# The finished video goes to the top of the deliverable folder: 03-demo-video/nanfeng-demo.mp4.
#        SHORT=1 ./make.sh render   also the 2:30 cut for slide 4 of the deck
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-all}" = "all" ]; then
  node tts/tts.mjs
  node tts/polish.mjs
  node record/record.mjs
fi
node plan.mjs --write

FINAL=../../nanfeng-demo.mp4
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
}
render NanFengDemo nanfeng-demo "$FINAL"
[ "${SHORT:-0}" = 1 ] && render NanFengDemoShort nanfeng-demo-short

d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$FINAL")
awk -v d="$d" 'BEGIN { if (d > 300) { print "FAIL: the demo is longer than 5:00"; exit 1 } else print "OK: demo is " int(d/60) ":" sprintf("%02d", d%60) " (limit 5:00)" }'
