#!/usr/bin/env bash
# GIF (540×540, 15 fps, palettegen/paletteuse, ≤ 10 MB) from the 1:1 render, plus poster.png (final badge frame).
# The film grain is denoised for the GIF only (grain makes GIF palettes/compression explode).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=out/flagday_1x1.mp4
DN="hqdn3d=6:4:9:6"
make_gif () { # size fps
  ffmpeg -v error -y -i "$SRC" -vf "fps=$2,$DN,scale=$1:$1:flags=lanczos,palettegen=max_colors=192:stats_mode=diff" /tmp/flagday_palette.png
  ffmpeg -v error -y -i "$SRC" -i /tmp/flagday_palette.png \
    -lavfi "fps=$2,$DN,scale=$1:$1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
    -loop 0 out/flagday_loop.gif
  stat -c%s out/flagday_loop.gif
}
SZ=$(make_gif 540 15)
for try in "480 15" "480 12" "400 12" "360 12"; do
  [ "$SZ" -le 10485760 ] && break
  echo "GIF $SZ bytes > 10 MB, retrying with $try"; SZ=$(make_gif $try)
done
echo "flagday_loop.gif: $SZ bytes"
# Poster: final badge frame rendered losslessly straight from the composition (skip with SKIP_POSTER=1)
if [ "${SKIP_POSTER:-0}" != 1 ]; then
  node scripts/render_stills.mjs FlagDay 419 1 out/.poster && mv out/.poster/FlagDay_419.png out/poster.png && rmdir out/.poster
fi
