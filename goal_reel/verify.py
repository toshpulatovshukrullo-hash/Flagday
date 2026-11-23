"""Yakuniy faylni tekshirish: o'lcham, davomiylik, fps, ovoz, sahna kliplari, matnlarda raqam yo'qligi."""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "output/gol_reel_final.mp4")


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


p = probe(F)
v = next(s for s in p["streams"] if s["codec_type"] == "video")
a = next(s for s in p["streams"] if s["codec_type"] == "audio")
dur = float(p["format"]["duration"])
checks = [
    ("1080x1920", (v["width"], v["height"]) == (1080, 1920)),
    ("30 fps", v["r_frame_rate"] == "30/1"),
    (f"davomiylik 14-18 s ({dur:.2f} s)", 14 <= dur <= 18),
    ("yuv420p / h264", v["pix_fmt"] == "yuv420p" and v["codec_name"] == "h264"),
    ("ovoz (aac, 48 kHz)", a["codec_name"] == "aac" and a["sample_rate"] == "48000"),
]
scenes = sorted(os.listdir(os.path.join(ROOT, "output/scenes")))
checks.append((f"sahna kliplari: {len(scenes)}", len(scenes) == 9))

src = open(os.path.join(ROOT, "goal_reel/render.py"), encoding="utf-8").read()
texts = re.findall(r'Line\("([^"]+)"', src)
checks.append(("ekran matnlarida raqam yo'q", not any(re.search(r"\d", t) for t in texts)))

lo = subprocess.run(["ffmpeg", "-i", F, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
m = re.findall(r"I:\s+(-?[\d.]+) LUFS", lo)
if m:
    checks.append((f"balandlik {m[-1]} LUFS (maqsad -14)", abs(float(m[-1]) + 14) < 1.5))

ok = True
for name, res in checks:
    print(("OK   " if res else "FAIL ") + name)
    ok &= res
print("matnlar:", *texts, sep="\n  ")
raise SystemExit(0 if ok else 1)
