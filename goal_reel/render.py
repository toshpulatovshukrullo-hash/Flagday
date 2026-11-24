"""Gol reeli: Eldor Shomurodov (78-daqiqa) — kinematografik rekonstruksiya.

Manba: faqat input/videos/A_vertikal_720x1280.mp4 (25 fps, 9:16).
Natija: 1080x1920, 30 fps. Virtual kamera (yaqinlashish / uzoqlashish), speed ramp,
muzlatish (freeze), optik oqim (DIS) asosida oraliq kadr interpolyatsiyasi, ekran matnlari.

Ishga tushirish:  python3 goal_reel/render.py  (audio: goal_reel/audio.py, yig'ish: goal_reel/build.sh)
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "input/videos/A_vertikal_720x1280.mp4")
OUT_DIR = os.path.join(ROOT, "output")
FONTS = os.path.join(ROOT, "goal_reel/fonts")
W, H, FPS = 1080, 1920, 30
SRC_FPS = 25.0
SW, SH = 720, 1280
BASE = W / SW  # 1.5: manba kengligi kadrni to'liq qoplaydi (z = 1)

# Xavfsiz zona: yuqori 15% (288 px) va pastki 20% (384 px) + 60 px chekka
SAFE_TOP, SAFE_BOT, SAFE_X = 288 + 60, H - 384 - 60, 60


# ----------------------------------------------------------------------------- helpers
def clamp(x, a, b):
    return max(a, min(b, x))


def smooth(v):
    v = clamp(v, 0.0, 1.0)
    return v * v * (3 - 2 * v)


def ease_out(v):
    v = clamp(v, 0.0, 1.0)
    return 1 - (1 - v) ** 3


def lerp(a, b, t):
    return a + (b - a) * t


def ramp_src(t0, dur, a, b):
    """Tezlik a -> b (smoothstep bo'yicha) ramp. Manba vaqtini qaytaruvchi funksiya.
    src(u) = t0 + dur * (a v + (b - a)(v^3 - v^4 / 2)),  v = u / dur."""

    def f(u):
        v = clamp(u / dur, 0.0, 1.0)
        return t0 + dur * (a * v + (b - a) * (v ** 3 - v ** 4 / 2))

    return f


def ramp_end(t0, dur, a, b):
    return ramp_src(t0, dur, a, b)(dur)


def keyframes(u, keys):
    """keys: [(u, value), ...] — smoothstep orasida interpolyatsiya."""
    if u <= keys[0][0]:
        return keys[0][1]
    for (u0, v0), (u1, v1) in zip(keys, keys[1:]):
        if u <= u1:
            return lerp(v0, v1, smooth((u - u0) / (u1 - u0)))
    return keys[-1][1]


# ----------------------------------------------------------------------------- source + optical flow
print("manba o'qilmoqda ...", flush=True)
cap = cv2.VideoCapture(SRC)
FRAMES = []
while True:
    ok, fr = cap.read()
    if not ok:
        break
    FRAMES.append(fr)
NF = len(FRAMES)
print(f"  {NF} kadr", flush=True)

_flow_cache = {}
_grid = np.dstack(np.meshgrid(np.arange(SW, dtype=np.float32), np.arange(SH, dtype=np.float32)))

# AI bilan tiniqlashtirilgan kadrlar (goal_reel/enhance_frames.py, Real-ESRGAN, 2x). Bo'lmasa — Lanczos 2x.
ESC = 2
ENH_DIR = os.path.join(ROOT, "output/cache_enh")
_grid2 = np.dstack(np.meshgrid(np.arange(SW * ESC, dtype=np.float32), np.arange(SH * ESC, dtype=np.float32)))
_hi_cache = {}
ENH_USED, ENH_MISSING = set(), set()


def HI(i):
    if i not in _hi_cache:
        p = os.path.join(ENH_DIR, f"f{i:04d}.png")
        if os.path.exists(p):
            _hi_cache[i] = cv2.imread(p)
            ENH_USED.add(i)
        else:
            ENH_MISSING.add(i)
            _hi_cache[i] = cv2.resize(FRAMES[i], (SW * ESC, SH * ESC), interpolation=cv2.INTER_LANCZOS4)
    return _hi_cache[i]


# Telekanal logotipi qimirlamaydi: uning hududida oqim nolga tenglanadi (logotip buzilmaydi, o'zgartirilmaydi)
LOGO_BOX = (470, 60, 690, 125)  # x0, y0, x1, y1 (manba piksellarida)


def _smooth_flow(f):
    f = np.dstack([cv2.medianBlur(np.ascontiguousarray(f[..., k]), 5) for k in range(2)])
    x0, y0, x1, y1 = LOGO_BOX
    f[y0:y1, x0:x1] = 0
    return f


def _visibility(fa, fb):
    """Oldinga-orqaga moslik: fa(x) + fb(x + fa(x)) ~ 0 bo'lsa piksel ko'rinadi."""
    m = _grid + fa
    fb_w = cv2.remap(fb, m[..., 0], m[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    err = np.linalg.norm(fa + fb_w, axis=2)
    tol = 1.5 + 0.08 * np.linalg.norm(fa, axis=2)
    return np.exp(-(err / tol) ** 2).astype(np.float32)


def _flows(i):
    if i not in _flow_cache:
        g0 = cv2.cvtColor(FRAMES[i], cv2.COLOR_BGR2GRAY)
        g1 = cv2.cvtColor(FRAMES[i + 1], cv2.COLOR_BGR2GRAY)
        # Farneback: yirik harakat va xira kadrlarda DIS ga qaraganda kamroq "yirtilish" beradi
        fb = lambda a, b: cv2.calcOpticalFlowFarneback(a, b, None, 0.5, 6, 41, 5, 7, 1.5, 0)
        f01 = _smooth_flow(fb(g0, g1))
        f10 = _smooth_flow(fb(g1, g0))
        one = np.ones(f01.shape[:2], np.float32)
        _flow_cache[i] = (f01, f10, one, one)
    return _flow_cache[i]


def _warp(img, flow):
    m = _grid + flow
    return cv2.remap(img, m[..., 0], m[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def src_frame(t, lo, hi):
    """Manba vaqti t (s) dagi kadr. [lo, hi] — kesmalardan o'tmaslik uchun kadr chegaralari.
    Oraliq kadr: ikki tomonlama Farneback optik oqimi (Super-SloMo taxmini)."""
    x = clamp(t * SRC_FPS, lo, hi)
    i = int(math.floor(x))
    a = x - i
    if i >= hi or a < 0.03:
        return HI(min(i, hi)).astype(np.float32)
    if a > 0.97:
        return HI(i + 1).astype(np.float32)
    f01, f10, _, _ = _flows(i)
    # oqim 720p da hisoblanadi, 2x tiniqlashtirilgan kadrlarga masshtablanadi
    up = lambda f: cv2.resize(f, (SW * ESC, SH * ESC), interpolation=cv2.INTER_LINEAR) * ESC
    ft0 = up(-(1 - a) * a * f01 + a * a * f10)
    ft1 = up((1 - a) ** 2 * f01 - a * (1 - a) * f10)
    w = lambda img, fl: cv2.remap(img, *(lambda m: (m[..., 0], m[..., 1]))(_grid2 + fl), cv2.INTER_LINEAR,
                                  borderMode=cv2.BORDER_REPLICATE)
    return (1 - a) * w(HI(i), ft0).astype(np.float32) + a * w(HI(i + 1), ft1).astype(np.float32)


# ----------------------------------------------------------------------------- virtual camera
def camera(img, z, cx, cy, rot_deg=0.0):
    th = math.radians(abs(rot_deg))
    z = max(z, math.cos(th) + (H / W) * math.sin(th) if rot_deg else 1.0)  # kadrni to'liq qoplash
    hw, hh = SW / (2 * z), SH / (2 * z)
    cx, cy = clamp(cx, hw, SW - hw), clamp(cy, hh, SH - hh)
    k = img.shape[1] / SW  # 2: tiniqlashtirilgan kadr
    s = BASE * z / k
    M = cv2.getRotationMatrix2D((cx * k, cy * k), rot_deg, s)
    M[0, 2] += W / 2 - cx * k
    M[1, 2] += H / 2 - cy * k
    out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_AREA if s < 1 else cv2.INTER_LANCZOS4,
                         borderMode=cv2.BORDER_REFLECT)
    if s > 1.05:  # kattalashtirishdan keyingi yengil keskinlik
        blur = cv2.GaussianBlur(out, (0, 0), 1.0)
        out = cv2.addWeighted(out, 1.25, blur, -0.25, 0)
    return out


# ----------------------------------------------------------------------------- grade
_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
_vig = ((_xx - W / 2) / (W * 0.62)) ** 2 + ((_yy - H / 2) / (H * 0.62)) ** 2
VIGNETTE = np.clip(1 - 0.55 * _vig, 0.35, 1)[..., None]
_rng = np.random.default_rng(78)


def grade(img, freeze=0.0, vig=1.0):
    x = np.clip(img, 0, 255) / 255.0
    x = x * x * (3 - 2 * x) * 0.35 + x * 0.65  # yumshoq S-egri (kontrast)
    lum = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    sat = lerp(1.12, 0.45, freeze)
    x = lum + (x - lum) * sat
    if freeze > 0:  # vaqt to'xtagan lahza: sovuq ton
        x = x * (1 - 0.18 * freeze) + np.array([0.10, 0.04, -0.02]) * freeze * 0.5 + 0.09 * freeze * lum
    v = 1 - (1 - VIGNETTE) * (vig + 0.6 * freeze)
    x = x * v
    x = x * 255 + _rng.normal(0, 2.4, (H, W, 1))  # plyonka donadorligi
    return np.clip(x, 0, 255)


# ----------------------------------------------------------------------------- text
def font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Montserrat-latin-{weight}.ttf"), size)


def fit_font(text, weight, size, max_w, tracking=0):
    while size > 10:
        f = font(weight, size)
        if text_w(text, f, tracking) <= max_w:
            return f
        size -= 2
    return font(weight, size)


def text_w(text, f, tracking=0):
    return f.getlength(text) + tracking * max(len(text) - 1, 0)


def draw_tracked(d, xy, text, f, fill, tracking=0):
    x, y = xy
    if not tracking:
        d.text((x, y), text, font=f, fill=fill)
        return
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + tracking


ORANGE = (255, 122, 26)
WHITE = (255, 255, 255)
NAVY = (14, 26, 64)


class Line:
    def __init__(self, text, weight, size, color, y, t0, t1, align="left", tracking=0, max_w=W - 2 * SAFE_X,
                 delay=0.0, kind="slide", bar=False):
        self.text, self.color, self.y = text, color, y
        self.f = fit_font(text, weight, size, max_w, tracking)
        self.tracking, self.align, self.kind, self.bar = tracking, align, kind, bar
        self.t0, self.t1 = t0 + delay, t1
        self.w = text_w(text, self.f, tracking)
        asc, desc = self.f.getmetrics()
        self.h = asc + desc


def render_overlay(t, lines):
    """RGBA overlay (numpy float, 0..1 alpha)."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    any_ = False
    for ln in lines:
        if not (ln.t0 <= t <= ln.t1):
            continue
        any_ = True
        a_in = ease_out((t - ln.t0) / 0.35)
        a_out = 1 - smooth((t - (ln.t1 - 0.25)) / 0.25)
        alpha = a_in * a_out
        dy = (1 - a_in) * 36 if ln.kind == "slide" else 0
        x = SAFE_X if ln.align == "left" else (W - ln.w) / 2
        y = ln.y + dy
        if ln.kind == "punch":  # "GOL!" — kattadan kichrayib urilish
            p = ease_out((t - ln.t0) / 0.22)
            sc = lerp(1.9, 1.0, p)
            f2 = font(900, int(ln.f.size * sc))
            w2 = text_w(ln.text, f2, ln.tracking)
            asc, desc = f2.getmetrics()
            x, y = (W - w2) / 2, ln.y + ln.h / 2 - (asc + desc) / 2
            jit = 6 * (1 - p) * math.sin(t * 90)
            col = ln.color + (int(255 * alpha),)
            for lay, off, c in ((glow, 0, ORANGE + (int(230 * alpha),)), (shadow, 10, (0, 0, 0, int(170 * alpha)))):
                draw_tracked(ImageDraw.Draw(lay), (x + jit + off, y + off), ln.text, f2, c, ln.tracking)
            draw_tracked(ImageDraw.Draw(layer), (x + jit, y), ln.text, f2, col, ln.tracking)
            continue
        if ln.bar:
            bw = 10
            ImageDraw.Draw(layer).rectangle([x, y + 6, x + bw, y + ln.h - 4], fill=ORANGE + (int(255 * alpha),))
            x += bw + 18
        draw_tracked(ImageDraw.Draw(shadow), (x + 3, y + 4), ln.text, ln.f, (0, 0, 0, int(200 * alpha)), ln.tracking)
        draw_tracked(ImageDraw.Draw(layer), (x, y), ln.text, ln.f, ln.color + (int(255 * alpha),), ln.tracking)
    if not any_:
        return None
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    glow = glow.filter(ImageFilter.GaussianBlur(26))
    base = Image.alpha_composite(Image.alpha_composite(glow, shadow), layer)
    arr = np.asarray(base).astype(np.float32) / 255.0
    return arr


def composite(img, ov):
    if ov is None:
        return img
    rgb = ov[..., 2::-1] * 255.0  # RGBA -> BGR
    a = ov[..., 3:4]
    return img * (1 - a) + rgb * a


def gradient_bottom(img, strength, y0=1000):
    """Pastki matn ostiga yumshoq qoraytirish."""
    if strength <= 0:
        return img
    g = np.clip((np.arange(H, dtype=np.float32) - y0) / 520.0, 0, 1)[:, None, None] * 0.72 * strength
    return img * (1 - g)


# ----------------------------------------------------------------------------- scenes
# Manba kadr indekslari (25 fps): kesmalar 27.56 s va 30.80 s da.
SCENES = []


def scene(name, dur, src, lo, hi, cam, freeze=0.0, interp=True):
    SCENES.append(dict(name=name, dur=dur, src=src, lo=lo, hi=hi, cam=cam, freeze=freeze, interp=interp))


# 1) "Dron" kirishi — jonli efirning yuqori keng kadri, kamera o'yinchiga tushib keladi (100%)
scene("01_dron", 3.0, lambda u: 6.52 + u, 160, 245,
      lambda u, t: (1.12 + 0.72 * smooth(u / 3.0), lerp(360, 525, smooth(u / 3.0)), lerp(640, 790, smooth(u / 3.0)),
                    4.0 * (1 - smooth(u / 3.0))))

# 2) Muzlatilgan lahza: zarba arafasi (kadr 721), 0% tezlik. Kamera yaqinlashadi va uzoqlashadi (360° o'rniga)
scene("02_muzlatish", 3.0, lambda u: 721 / SRC_FPS, 721, 721,
      lambda u, t: (keyframes(u, [(0, 1.08), (1.55, 1.85), (3.0, 1.12)]),
                    keyframes(u, [(0, 420), (1.55, 545), (3.0, 430)]),
                    keyframes(u, [(0, 600), (1.55, 800), (3.0, 640)]),
                    3.0 * math.sin(math.pi * u / 3.0)), freeze=1.0)

# 3) Makro: butsa va to'p tegishuvi, 10% tezlik (zarba lahzasi 32.30 s -> sahnaning 1.0 s)
scene("03_makro", 2.0, lambda u: 32.20 + 0.10 * u, 803, 812,
      lambda u, t: (lerp(1.6, 1.85, smooth(u / 2.0)), lerp(500, 570, smooth(u / 2.0)), lerp(860, 760, smooth(u / 2.0)), 0.0))

# 4) To'p ortidan kuzatuvchi kamera: 10% -> 100% silliq ramp
S4 = ramp_src(32.40, 1.4, 0.10, 1.0)
scene("04_ramp", 1.4, S4, 808, 829,
      lambda u, t: (1.45, 500, keyframes(t * SRC_FPS, [(810, 820), (815, 520), (821, 500), (829, 640)]), 0.0))

# 5) Darvozaga yaqin yon kamera (takror): darvozabon sakrashi, 100%
scene("05_darvoza_yoni", 0.8, lambda u: 29.64 + u, 740, 762,
      lambda u, t: (lerp(1.22, 1.34, u / 0.8), 380, 600, 0.0))

# 6) Muzlatish: to'p chiziq (to'sin) oldida, 2% tezlik + kichik tebranish
scene("06_chiziq_oldi", 1.0, lambda u: 33.50 + 0.02 * u, 837, 839,
      lambda u, t: (lerp(1.50, 1.62, smooth(u)), 330 + 3 * math.sin(u * 37), 640 + 3 * math.cos(u * 29), 0.0), freeze=0.8)

# 7a) Pastki rakurs: to'p to'sin ostidan to'rga kiradi, 20% -> 100%
S7A_DUR = 0.75
S7A = ramp_src(33.52, S7A_DUR, 0.20, 1.0)
scene("07_gol", S7A_DUR, S7A, 838, 849,
      lambda u, t: (lerp(1.62, 1.30, smooth(u / S7A_DUR)), lerp(330, 400, smooth(u / S7A_DUR)),
                    lerp(640, 760, smooth(u / S7A_DUR)), 0.0))
# 7b) Darvoza yonidan: to'r silkinadi, darvozabon yerga tushadi (40%)
scene("07_gol_b", 0.9, lambda u: 30.40 + 0.40 * u, 760, 769,
      lambda u, t: (lerp(1.25, 1.12, smooth(u / 0.9)), 420, 580, 0.0))

# 8) Yakuniy kadr: Shomurodovning yaqin plani (~56%). Yuz buzilmasligi uchun optik oqim ishlatilmaydi —
#    faqat haqiqiy kadrlar (eng yaqin kadr).
scene("08_yakun", 3.0, lambda u: (428 + 42 * u / 3.0) / SRC_FPS, 428, 470,
      lambda u, t: (lerp(1.08, 1.16, smooth(u / 3.0)), 360, 580, 0.0), interp=False)

# Sahna boshlanish vaqtlari
t = 0.0
for s in SCENES:
    s["start"] = t
    t += s["dur"]
TOTAL = t
NFRAMES = int(round(TOTAL * FPS))
ST = {s["name"]: s["start"] for s in SCENES}

# "GOL!" lahzasi — to'p to'sin ostidan o'tadigan kadr (840.5 -> 33.62 s)
GOAL_SRC = 840.5 / SRC_FPS
u = 0.0
while S7A(u) < GOAL_SRC and u < S7A_DUR:
    u += 0.001
T_GOAL = ST["07_gol"] + u
T_KICK = ST["03_makro"] + (32.30 - 32.20) / 0.10

# ----------------------------------------------------------------------------- texts (uz, raqamlar harf bilan)
s1, s2, s8 = ST["01_dron"], ST["02_muzlatish"], ST["08_yakun"]
LINES = [
    # doimiy belgi
    Line("GOL REKONSTRUKSIYASI", 800, 26, WHITE, SAFE_TOP, 0.15, TOTAL - 3.0 + 0.2, tracking=6, bar=True,
         kind="fade"),
    # 1-sahna
    Line("ELDOR SHOMURODOV", 900, 96, WHITE, 1150, s1 + 0.35, s1 + 2.95, tracking=1),
    Line("Bashakshehir", 800, 54, ORANGE, 1262, s1 + 0.35, s1 + 2.95, delay=0.15),
    Line("Chorum FK qarshi", 600, 44, WHITE, 1336, s1 + 0.35, s1 + 2.95, delay=0.3),
    # 2-sahna
    Line("yetmish sakkizinchi daqiqa", 900, 64, WHITE, 1230, s2 + 0.3, s2 + 2.9),
    Line("Turkiya Superligasi, oʻn ikkinchi tur", 600, 38, (225, 230, 240), 1316, s2 + 0.3, s2 + 2.9, delay=0.15),
    # 7-sahna
    Line("GOL!", 900, 250, WHITE, 760, T_GOAL, ST["08_yakun"] + 0.05, align="center", tracking=4, kind="punch"),
    Line("nol–ikkidan bir–ikkiga", 800, 46, WHITE, 1060, T_GOAL + 0.3, ST["08_yakun"] + 0.05, align="center"),
    # 8-sahna
    Line("SUPERKAMBEK", 800, 34, ORANGE, 1010, s8 + 0.25, TOTAL, tracking=8, bar=True),
    Line("ELDOR SHOMURODOV", 900, 72, WHITE, 1066, s8 + 0.25, TOTAL, delay=0.1),
    Line("Bashakshehir: toʻrt, Chorum FK: ikki", 800, 46, WHITE, 1160, s8 + 0.25, TOTAL, delay=0.2),
    Line("Shomurodovning gol zarbasi:", 600, 36, (225, 230, 240), 1240, s8 + 0.25, TOTAL, delay=0.3),
    Line("uzoq masofadan toʻqqizlikka", 800, 36, ORANGE, 1288, s8 + 0.25, TOTAL, delay=0.35),
    Line("Gol rekonstruksiyasi", 600, 30, (200, 205, 215), 1372, s8 + 0.25, TOTAL, delay=0.45, bar=True),
]
for ln in LINES:  # xavfsiz zona tekshiruvi
    if ln.kind != "punch":
        assert SAFE_TOP <= ln.y and ln.y + ln.h <= SAFE_BOT, (ln.text, ln.y, ln.h)


# ----------------------------------------------------------------------------- frame renderer
def render(n):
    t = n / FPS
    for s in SCENES:
        if s["start"] <= t < s["start"] + s["dur"] - 1e-9 or s is SCENES[-1]:
            break
    u = t - s["start"]
    st = s["src"](u)
    if s["interp"]:
        img = src_frame(st, s["lo"], s["hi"])
    else:
        img = HI(int(clamp(round(st * SRC_FPS), s["lo"], s["hi"]))).astype(np.float32)
    z, cx, cy, rot = s["cam"](u, st)
    # zarba va gol lahzalarida silkinish
    for tk, amp in ((T_KICK, 14), (T_GOAL, 10)):
        d = t - tk
        if 0 <= d < 0.35:
            k = amp * math.exp(-d * 12)
            cx += k * math.sin(d * 120) / z
            cy += k * math.cos(d * 97) / z
    out = camera(img, z, cx, cy, rot)
    # muzlatishga kirish/chiqishda silliq rang o'tishi
    fz = s["freeze"]
    if fz:
        fz *= min(1.0, smooth(u / 0.25)) * min(1.0, smooth((s["dur"] - u) / 0.2) * 0.6 + 0.4)
    out = grade(out, freeze=fz)
    # matn ostiga qoraytirish
    gstr = 0.0
    if s["name"] in ("01_dron", "02_muzlatish"):
        gstr = smooth(u / 0.4) * smooth((s["dur"] - u) / 0.3)
    if s["name"] == "08_yakun":
        gstr = smooth(u / 0.5) * 1.15
    out = gradient_bottom(out, gstr, y0=920)
    # oq chaqnashlar
    for tf, a0, dec in ((T_KICK, 0.55, 18), (T_GOAL, 0.45, 10), (ST["02_muzlatish"], 0.25, 25)):
        d = t - tf
        if 0 <= d < 0.4:
            out = out + (255 - out) * a0 * math.exp(-d * dec)
    # 7 -> 8 o'tishi: qorong'ilik orqali
    d = t - ST["08_yakun"]
    if -0.12 <= d < 0.18:
        out = out * (0.35 + 0.65 * smooth(abs(d) / (0.12 if d < 0 else 0.18)))
    # oxirida qorayish
    if t > TOTAL - 0.4:
        out = out * smooth((TOTAL - t) / 0.4)
    out = composite(out, render_overlay(t, LINES))
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    only = sys.argv[1:]  # ixtiyoriy: kadr raqamlari -> PNG (QA)
    if only:
        os.makedirs(os.path.join(OUT_DIR, "qa"), exist_ok=True)
        for a in only:
            n = int(a)
            cv2.imwrite(os.path.join(OUT_DIR, "qa", f"f{n:04d}.png"), render(n))
        return
    path = os.path.join(OUT_DIR, "video_noaudio.mp4")
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                           "-pix_fmt", "yuv420p", path], stdin=subprocess.PIPE)
    for n in range(NFRAMES):
        ff.stdin.write(render(n).tobytes())
        if n % 30 == 0:
            print(f"  kadr {n}/{NFRAMES}", flush=True)
    ff.stdin.close()
    ff.wait()
    with open(os.path.join(OUT_DIR, "timeline.txt"), "w") as fh:
        fh.write(f"TOTAL {TOTAL:.3f}\nT_KICK {T_KICK:.3f}\nT_GOAL {T_GOAL:.3f}\n")
        for s in SCENES:
            fh.write(f"{s['name']} {s['start']:.3f} {s['dur']:.3f} src {s['src'](0):.3f}->{s['src'](s['dur']):.3f}\n")
    print("tayyor:", path, f"{TOTAL:.2f}s", flush=True)
    print(f"AI kadrlar: {len(ENH_USED)}, tiniqlashtirilmagan (Lanczos): {sorted(ENH_MISSING)}", flush=True)


if __name__ == "__main__":
    main()
