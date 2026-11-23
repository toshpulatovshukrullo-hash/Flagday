#!/usr/bin/env bash
# Gol reeli: to'liq yig'ish. Talab: python3 (opencv-python-headless, numpy, pillow, scipy), ffmpeg.
#   bash goal_reel/build.sh            # render + audio + mux + sahna kliplari + tekshiruv
#   SKIP_RENDER=1 bash goal_reel/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/scenes

[ "${SKIP_RENDER:-0}" = 1 ] || python3 goal_reel/render.py
python3 goal_reel/audio.py

# Ovozni Instagram uchun -14 LUFS ga moslash va video bilan birlashtirish
ffmpeg -v error -y -i output/video_noaudio.mp4 -i output/audio.wav \
  -filter:a "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:v libx264 -preset slow -crf 19 -maxrate 16M -bufsize 32M -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart -shortest output/gol_reel_final.mp4

# Har bir sahnaning alohida klipi (kadr aniqligida qayta kodlanadi)
while read -r name start dur _; do
  case "$name" in 0*) ;; *) continue ;; esac
  ffmpeg -nostdin -v error -y -ss "$start" -i output/gol_reel_final.mp4 -t "$dur" \
    -c:v libx264 -preset slow -crf 19 -maxrate 16M -bufsize 32M -pix_fmt yuv420p -c:a aac -b:a 256k "output/scenes/${name}.mp4"
done < output/timeline.txt

python3 goal_reel/verify.py
