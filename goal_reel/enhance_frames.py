"""Reelda ishlatiladigan manba kadrlarini Real-ESRGAN (general, denoise 0.5) bilan 2x tiniqlashtirib keshlash.

  GOAL_REEL_MODELS=<og'irliklar papkasi> python3 goal_reel/enhance_frames.py
Natija: output/cache_enh/fXXXX.png (1440x2560). render.py ularni avtomatik ishlatadi.
"""
import os
import sys
import time

import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enhance  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "output/cache_enh")
# render.py sahnalari ishlatadigan kadr oraliqlari (har ikki chekka bilan)
RANGES = [(163, 239), (721, 722), (803, 830), (740, 769), (837, 849), (428, 470)]

os.makedirs(OUT, exist_ok=True)
need = sorted({i for a, b in RANGES for i in range(a, b + 1)})
todo = [i for i in need if not os.path.exists(os.path.join(OUT, f"f{i:04d}.png"))]
print(f"{len(need)} kadr kerak, {len(todo)} tasi qoldi", flush=True)

cap = cv2.VideoCapture(os.path.join(ROOT, "input/videos/A_vertikal_720x1280.mp4"))
frames, i = {}, 0
while True:
    ok, f = cap.read()
    if not ok:
        break
    if i in todo:
        frames[i] = f
    i += 1

net, sc = enhance.build("general", denoise=0.5)
t0 = time.time()
for n, i in enumerate(todo, 1):
    big = enhance.upscale(net, sc, frames[i])
    out = cv2.resize(big, (1440, 2560), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, f"f{i:04d}.png"), out, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    el = time.time() - t0
    print(f"  {n}/{len(todo)} kadr {i}  ~{el / n * (len(todo) - n) / 60:.0f} daqiqa qoldi", flush=True)
print("tayyor", flush=True)
