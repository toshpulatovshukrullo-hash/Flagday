"""Gol reeli uchun ovoz dizayni — to'liq sintez (mualliflik huquqidan xoli, tashqi namunalar yo'q).

Sahna vaqtlari output/timeline.txt dan o'qiladi (render.py yozadi).
Natija: output/audio.wav (48 kHz, stereo, 24-bit).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "output")
SR = 48000
rng = np.random.default_rng(20261123)

# ----------------------------------------------------------------------------- timeline
TL = {}
for line in open(os.path.join(OUT, "timeline.txt")):
    p = line.split()
    if len(p) == 2:
        TL[p[0]] = float(p[1])
    else:
        TL[p[0]] = (float(p[1]), float(p[2]))
TOTAL, T_KICK, T_GOAL = TL["TOTAL"], TL["T_KICK"], TL["T_GOAL"]
S = {k: v for k, v in TL.items() if isinstance(v, tuple)}
t_s2, t_s3 = S["02_muzlatish"][0], S["03_makro"][0]
t_s4, t_s5 = S["04_ramp"][0], S["05_darvoza_yoni"][0]
t_s6, t_s7 = S["06_chiziq_oldi"][0], S["07_gol"][0]
t_s8 = S["08_yakun"][0]

N = int(TOTAL * SR)
mix = {k: np.zeros((N, 2)) for k in ("music", "fx", "amb")}


# ----------------------------------------------------------------------------- dsp helpers
def tt(n):
    return np.arange(n) / SR


def filt(x, kind, f, order=4):
    if kind == "bp":
        sos = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], "band", output="sos")
    else:
        sos = butter(order, f / (SR / 2), kind, output="sos")
    return sosfilt(sos, x, axis=0)


def noise(n, ch=2):
    return rng.standard_normal((n, ch)) if ch > 1 else rng.standard_normal(n)


def pink(n, ch=2):
    w = np.fft.rfft(rng.standard_normal((n, ch)), axis=0)
    f = np.arange(w.shape[0]) + 1
    x = np.fft.irfft(w / np.sqrt(f)[:, None], n=n, axis=0)
    return x / np.abs(x).max()


def env_adsr(n, a, r, curve=4.0):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    e *= np.exp(-curve * np.maximum(tt(n) - a, 0) / max(r, 1e-3))
    return e


def add(bus, t0, sig, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if sig.ndim == 1:
        l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    j = min(N, i0 + len(sig))
    if j > i0:
        mix[bus][i0:j] += sig[: j - i0] * gain


def fade_mask(t0, t1, fin=0.05, fout=0.05):
    m = np.zeros(N)
    x = tt(N)
    m[(x >= t0) & (x < t1)] = 1
    m *= np.clip((x - t0) / fin, 0, 1) * np.clip((t1 - x) / fout, 0, 1)
    return m[:, None]


def saw(freq, n, harm=24):
    x = tt(n)
    out = np.zeros(n)
    for k in range(1, harm + 1):
        if freq * k > 9000:
            break
        out += np.sin(2 * np.pi * freq * k * x) / k
    return out


IR = noise(int(1.8 * SR)) * np.exp(-tt(int(1.8 * SR)) * 3.6)[:, None]
IR = filt(IR, "low", 5000) / 18.0


def reverb(x, wet=0.3):
    return x * (1 - wet) + fftconvolve(x, IR, axes=0)[: len(x)] * wet


# ----------------------------------------------------------------------------- 1) shamol + dron
n1 = int((t_s2 + 0.3) * SR)
w = filt(pink(n1), "low", 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * tt(n1)))[:, None]
add("amb", 0, w * env_adsr(n1, 0.4, 99)[:, None] * np.clip((t_s2 + 0.3 - tt(n1)) / 0.4, 0, 1)[:, None], 0.35)
rotor = (saw(92, n1, 12) * (0.55 + 0.45 * np.sin(2 * np.pi * 31 * tt(n1))) * 0.25 +
         filt(noise(n1, 1), "bp", (2500, 4500)) * 0.05)
dop = np.clip(1 - tt(n1) / t_s2, 0, 1) ** 0.5  # dron uzoqlashadi
add("amb", 0, rotor * dop * env_adsr(n1, 0.3, 99), 0.22, pan=0.25)

# ----------------------------------------------------------------------------- musiqa: D minor trailer pad
D2, A2, D3, F3, A3 = 73.42, 110.0, 146.83, 174.61, 220.0
n_a = int((t_s2 + 0.6) * SR)
pad = sum(saw(f, n_a, 16) * g for f, g in ((D2, 1.0), (A2, 0.6), (D3, 0.5), (F3, 0.35)))
pad = filt(pad, "low", 900)
pad *= np.clip(tt(n_a) / 1.6, 0, 1) * np.clip((t_s2 + 0.6 - tt(n_a)) / 0.6, 0, 1)
add("music", 0, reverb(pad[:, None].repeat(2, 1), 0.35), 0.10)
# ostinato (sakkizlik zarblar) 120 bpm
for k in range(int(t_s2 / 0.25)):
    n = int(0.22 * SR)
    note = saw(D2 if k % 8 < 6 else F3 / 2, n, 10) * env_adsr(n, 0.004, 0.18)
    add("music", k * 0.25, filt(note, "low", 600), 0.10 + 0.05 * (k % 2 == 0) + 0.04 * k / 12)


def taiko(gain, pitch=1.0, dur=1.2):
    n = int(dur * SR)
    x = tt(n)
    f = (95 * pitch) * np.exp(-x * 9) + 48 * pitch
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(n, 0.002, dur * 0.7, 5)
    sk = filt(noise(n, 1), "bp", (150, 1800)) * env_adsr(n, 0.001, 0.08, 6) * 0.5
    return reverb(((body + sk) * gain)[:, None].repeat(2, 1), 0.25)


for tk in (0.0, 1.5, 2.25, 2.62):
    add("music", tk, taiko(0.55), 1.0)

# ----------------------------------------------------------------------------- 2) sukunat + yurak urishi
n2 = int((t_s3 - t_s2) * SR)
sub = np.sin(2 * np.pi * 36 * tt(n2)) * 0.5 * np.clip(tt(n2) / 0.4, 0, 1)
add("music", t_s2, sub, 0.18)
for k in range(5):
    tb = t_s2 + 0.25 + k * 0.62
    for off, g in ((0, 1.0), (0.16, 0.7)):
        n = int(0.25 * SR)
        f = 55 * np.exp(-tt(n) * 6) + 38
        hb = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(n, 0.004, 0.14, 5)
        add("fx", tb + off, filt(hb, "low", 160), 0.85 * g)
# vaqt to'xtashi "shuv" tovushi
n = int(0.7 * SR)
add("fx", t_s2, filt(noise(n), "low", 1800) * np.exp(-tt(n) * 6)[:, None], 0.25)

# ----------------------------------------------------------------------------- 3) zarba: teskari "riser" + bass hit
n = int((T_KICK - t_s3) * SR)
rise = filt(noise(n), "bp", (800, 7000)) * (tt(n) / tt(n)[-1])[:, None] ** 3
add("fx", t_s3, rise, 0.22)
n = int(2.2 * SR)
x = tt(n)
f = 110 * np.exp(-x * 7) + 34
boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(n, 0.002, 1.6, 4)
click = filt(noise(n, 1), "hp", 2500) * env_adsr(n, 0.0005, 0.02, 6)
thud = filt(noise(n, 1), "low", 400) * env_adsr(n, 0.001, 0.12, 6)
kick = np.tanh(1.6 * (boom * 1.0 + click * 0.6 + thud * 0.7))
add("fx", T_KICK, reverb(kick[:, None].repeat(2, 1), 0.2), 0.95)

# ----------------------------------------------------------------------------- 4-5) whoosh + riser (tezlashish)
def whoosh(dur, f0, f1, gain, pan_sweep=0.6):
    n = int(dur * SR)
    x = tt(n) / dur
    src = noise(n, 1)
    out = np.zeros(n)
    seg = 1024
    for s in range(0, n, seg):  # harakatlanuvchi band-pass
        fc = f0 * (f1 / f0) ** (s / n)
        bw = fc * 0.6
        out[s:s + seg] = filt(src[max(0, s - 4096):s + seg], "bp", (max(60, fc - bw / 2), min(15000, fc + bw / 2)), 2)[-len(out[s:s + seg]):]
    e = np.sin(np.pi * np.clip(x, 0, 1)) ** 1.5
    out = out * e / (np.abs(out).max() + 1e-9)
    pan = np.linspace(-pan_sweep, pan_sweep, n)
    return np.stack([out * np.sqrt(0.5 * (1 - pan)), out * np.sqrt(0.5 * (1 + pan))], 1) * 1.4 * gain


add("fx", t_s4 - 0.05, whoosh(t_s5 - t_s4 + 0.1, 250, 3500, 0.55))
add("fx", t_s5 - 0.12, whoosh(0.55, 600, 5000, 0.45, -0.7))
n = int((t_s6 - t_s4) * SR)
x = tt(n) / (t_s6 - t_s4)
fr = 180 * (6 ** x)
riser = np.sin(2 * np.pi * np.cumsum(fr) / SR) * x ** 2 + filt(noise(n, 1), "hp", 3000) * x ** 3 * 0.4
add("music", t_s4, reverb(riser[:, None].repeat(2, 1), 0.3), 0.12)
for k in range(int((t_s6 - t_s4) / 0.125)):  # o'n oltilik pulsatsiya
    nn = int(0.1 * SR)
    add("music", t_s4 + k * 0.125, filt(saw(D2, nn, 8) * env_adsr(nn, 0.002, 0.08), "low", 700), 0.10 + 0.012 * k)

# ----------------------------------------------------------------------------- 6) bir lahzalik sukunat (faqat juda past "tinnitus")
n = int((t_s7 - t_s6) * SR)
tone = np.sin(2 * np.pi * 3900 * tt(n)) * np.exp(-tt(n) * 2.5) * 0.02
add("fx", t_s6, tone, 1.0)

# ----------------------------------------------------------------------------- 7) to'p uchishi, to'r, olomon, katta zarb
add("fx", t_s7, whoosh(T_GOAL - t_s7 + 0.15, 900, 4000, 0.35, 0.3))
n = int(0.9 * SR)
net = filt(noise(n), "bp", (1500, 7500)) * env_adsr(n, 0.01, 0.5, 4)[:, None]
net *= (1 + 0.6 * np.sin(2 * np.pi * 23 * tt(n)))[:, None]
add("fx", T_GOAL, net, 0.45)
add("fx", T_GOAL, reverb(np.tanh(1.4 * boom)[:, None].repeat(2, 1), 0.35), 0.8)
add("music", T_GOAL, taiko(0.9, 0.8, 1.6), 1.0)

# olomon: bir necha band-pass shovqin qatlamlari, sekin ko'tariladi
nc = N - int(T_GOAL * SR) + 1
xc = tt(nc)
crowd = np.zeros((nc, 2))
for lo, hi, g in ((250, 900, 1.0), (700, 2200, 0.7), (1800, 4000, 0.35)):
    layer = filt(noise(nc), "bp", (lo, hi))
    mod = 1 + 0.25 * filt(noise(nc, 1), "low", 3)[:, None] * 40
    crowd += layer * g * np.clip(mod, 0.3, 2)
crowd /= np.abs(crowd).max()
cenv = (1 - np.exp(-xc / 0.35)) * (0.85 + 0.15 * np.exp(-xc / 1.5))
cenv *= np.clip((TOTAL - T_GOAL - xc) / 1.2, 0, 1)
add("amb", T_GOAL - 0.05, crowd * cenv[:, None], 0.40)

# ----------------------------------------------------------------------------- 8) g'alaba akkordi (D major) + yakuniy zarblar
FS3 = 185.0
nb = N - int(T_GOAL * SR)
brass = sum(saw(f, nb, 20) * g for f, g in ((D2, 0.9), (A2, 0.6), (D3, 0.6), (FS3, 0.5), (A3, 0.45), (2 * D3, 0.25)))
lfo = 1 + 0.004 * np.sin(2 * np.pi * 5 * tt(nb))
brass = filt(brass * lfo, "low", 2400)
benv = np.clip(tt(nb) / 0.25, 0, 1) * np.clip((TOTAL - T_GOAL - tt(nb)) / 1.6, 0, 1)
add("music", T_GOAL, reverb((brass * benv)[:, None].repeat(2, 1), 0.4), 0.11)
for tk in (t_s8, t_s8 + 0.75, t_s8 + 1.5, t_s8 + 1.875):
    add("music", tk, taiko(0.6, 1.0), 1.0)

# ----------------------------------------------------------------------------- mix
# 6-sahnada hamma narsa (tinnitusdan tashqari) to'xtaydi
gate = 1 - fade_mask(t_s6, t_s7, 0.02, 0.03)
music = mix["music"] * gate
amb = mix["amb"] * gate
fx = mix["fx"]  # fx: 6-sahnada faqat tinnitus eshitiladi (boshqa fx u yerga yetmaydi)
out = music * 1.0 + fx * 1.0 + amb * 1.0
out = np.tanh(out * 1.1) / np.tanh(1.1)
out *= np.clip((TOTAL - tt(N)) / 0.5, 0, 1)[:, None]
out = out / (np.abs(out).max() + 1e-9) * 10 ** (-1.0 / 20)

pcm = (np.clip(out, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
b = np.zeros((N * 2, 3), np.uint8)
flat = pcm.reshape(-1)
b[:, 0] = flat & 0xFF
b[:, 1] = (flat >> 8) & 0xFF
b[:, 2] = (flat >> 16) & 0xFF
with wave.open(os.path.join(OUT, "audio.wav"), "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(3)
    wf.setframerate(SR)
    wf.writeframes(b.tobytes())
print("audio.wav", f"{TOTAL:.2f}s")
