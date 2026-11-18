"""8K still poster: 18-noyabr — Davlat bayrog'i kuni (Termiz davlat universiteti).

Everything is drawn procedurally (no upscaling), so it stays sharp at any size.
Usage: python3 scripts/poster_8k.py [width] [out_path]
       default 6144 px wide (6144x7680, 4:5) -> out/poster_8k.png + .jpg
"""
import sys, math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = __file__.rsplit('/scripts/', 1)[0]
W = int(sys.argv[1]) if len(sys.argv) > 1 else 6144
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{ROOT}/out/poster_8k.png'
H = W * 5 // 4
S = W / 1080.0                      # design units: 1080 x 1350
rng = np.random.default_rng(1991)
OK = 'ʻ'                       # Uzbek oʻ / gʻ mark

F_TITLE = f'{ROOT}/public/fonts/PlayfairDisplay-ExtraBold.ttf'
F_SEMI = f'{ROOT}/public/fonts/Montserrat-SemiBold.ttf'
F_REG = f'{ROOT}/public/fonts/Montserrat-Regular.ttf'

FLAG = dict(blue=(0x00, 0x99, 0xB5), white=(0xFF, 0xFF, 0xFF), green=(0x1E, 0xB5, 0x3A), red=(0xCE, 0x11, 0x26))
GOLD = np.array([255, 205, 110], np.float32) / 255


def hexf(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def up(a, w=W, h=H):
    return cv2.resize(a, (w, h), interpolation=cv2.INTER_CUBIC)


# ---------------------------------------------------------------- sky
def sky():
    h, w = H // 4, W // 4
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    top, mid, bot = hexf('#0657c2'), hexf('#1f8fef'), hexf('#8ad4ff')
    g = np.where(y < 0.55, top + (mid - top) * smooth(0, 0.55, y), mid + (bot - mid) * smooth(0.55, 1, y))
    g = np.broadcast_to(g, (h, w, 3)).copy()
    # sun glow, upper right
    d = np.sqrt(((x - 0.86) * 1.0) ** 2 + ((y - 0.20) * 1.25) ** 2)
    glow = np.exp(-(d / 0.30) ** 2) * 0.55 + np.exp(-(d / 0.07) ** 2) * 0.5
    g = g + (np.array([1.0, 0.98, 0.9], np.float32) - g) * np.clip(glow, 0, 1)
    # gentle vignette
    v = np.sqrt((x - 0.5) ** 2 + (y - 0.45) ** 2)
    g *= (1 - 0.18 * smooth(0.45, 0.85, v))
    return up(g)


def fbm(h, w, oct=6, base=4, seed=0):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(oct):
        n = base * 2 ** o
        grid = r.random((max(2, int(n * h / w)) + 1, n + 1)).astype(np.float32)
        acc += amp * cv2.resize(grid, (w, h), interpolation=cv2.INTER_CUBIC)
        tot += amp
        amp *= 0.52
    return acc / tot


def clouds(img):
    h, w = H // 4, W // 4
    n = cv2.GaussianBlur(fbm(h, w, 5, 3, seed=7), (0, 0), 1.2)
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    # where clouds may appear: bottom bank, right-middle drift, faint left wisps
    wgt = (smooth(0.62, 0.95, y) * 1.0
           + np.exp(-(((x - 0.95) / 0.22) ** 2 + ((y - 0.48) / 0.14) ** 2)) * 0.75
           + np.exp(-(((x - 0.02) / 0.18) ** 2 + ((y - 0.62) / 0.10) ** 2)) * 0.6
           + np.exp(-(((x - 0.30) / 0.30) ** 2 + ((y - 0.08) / 0.05) ** 2)) * 0.25)
    f = n * (0.40 + 0.85 * wgt)
    dens = smooth(0.42, 0.66, f)
    # lighting: lit from above -> compare with the field shifted toward the light
    sh = np.roll(n, int(h * 0.012), axis=0)
    lit = np.clip(0.97 + (n - sh) * 3.0 + smooth(0.5, 0.8, f) * 0.06, 0.80, 1.04)
    dens, lit = up(dens), up(lit)
    col = np.stack([lit * 0.965, lit * 0.982, lit * 1.0], -1)
    col = col + (1 - col) * 0.15
    a = (dens * 0.97)[..., None]
    return img * (1 - a) + np.clip(col, 0, 1) * a


# ---------------------------------------------------------------- flag
def flag_texture(tw):
    th = tw // 2
    ss = 2
    im = Image.new('RGB', (tw * ss, th * ss), FLAG['white'])
    d = ImageDraw.Draw(im)
    k = tw * ss / 250.0
    for y0, y1, c in [(0, 40, 'blue'), (40, 42.5, 'red'), (42.5, 82.5, 'white'), (82.5, 85, 'red'), (85, 125, 'green')]:
        d.rectangle([0, y0 * k, tw * ss, y1 * k], fill=FLAG[c])
    # crescent: outer disc minus cut disc (cx 35/40, cy 20, r 15)
    d.ellipse([(35 - 15) * k, (20 - 15) * k, (35 + 15) * k, (20 + 15) * k], fill=FLAG['white'])
    d.ellipse([(40 - 15) * k, (20 - 15) * k, (40 + 15) * k, (20 + 15) * k], fill=FLAG['blue'])
    ro, ri = 3 * k, 3 * 0.381966 * k
    for yy, cnt in [(8, 3), (20, 4), (32, 5)]:
        for j in range(cnt):
            cx, cy = (92 - 12 * j) * k, yy * k
            pts = [(cx + (ro if i % 2 == 0 else ri) * math.sin(i * math.pi / 5),
                    cy - (ro if i % 2 == 0 else ri) * math.cos(i * math.pi / 5)) for i in range(10)]
            d.polygon(pts, fill=FLAG['white'])
    im = im.resize((tw, th), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255


def draw_flag(img):
    X0, L, TOP, HF = 122, 930, 600, 465          # design units
    x0, x1 = int((X0 - 2) * S), W
    y0, y1 = int((TOP - 60) * S), int((TOP + HF + 110) * S)
    xs = (np.arange(x0, x1, dtype=np.float32) / S)[None, :]
    ys = (np.arange(y0, y1, dtype=np.float32) / S)[:, None]
    u = (xs - X0) / L
    uc = np.clip(u, 0, 1)
    yc = TOP + HF / 2 + 28 * uc ** 1.6
    hh = HF * (1 - 0.07 * uc)
    A = 30 * uc ** 0.75
    B = 7 * uc

    def disp(v):
        p1 = 2 * np.pi * (1.55 * uc - 0.30 * v) + 0.6
        p2 = 2 * np.pi * (4.1 * uc + 0.85 * v) + 1.7
        return A * np.sin(p1) + B * np.sin(p2), p1, p2

    v = (ys - yc) / hh + 0.5
    for _ in range(6):
        dd, p1, p2 = disp(np.clip(v, -0.2, 1.2))
        v = (ys - yc - dd) / hh + 0.5
    dd, p1, p2 = disp(np.clip(v, -0.2, 1.2))
    # coverage (analytic AA on all four edges)
    upx, vpx = L * S, hh * S
    cov = (np.clip(u * upx + 0.5, 0, 1) * np.clip((1 - u) * upx + 0.5, 0, 1)
           * np.clip(v * vpx + 0.5, 0, 1) * np.clip((1 - v) * vpx + 0.5, 0, 1)).astype(np.float32)
    tex = flag_texture(max(1024, int(L * S * 1.15)))
    th, tw = tex.shape[:2]
    mx = (np.clip(u, 0, 1) * (tw - 1)).astype(np.float32)
    my = (np.clip(v, 0, 1) * (th - 1)).astype(np.float32)
    mx, my = np.broadcast_to(mx, my.shape).copy(), my
    col = cv2.remap(tex, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # fold shading from the wave slope (light from upper left)
    slope = (np.cos(p1) * (A / 30)) * 0.9 + np.cos(p2) * (B / 7) * 0.25
    shade = 1 + 0.15 * slope - 0.09 * (1 - np.cos(p1)) ** 1.5 * (A / 30)
    spec = np.clip(np.cos(p1 - 0.5), 0, 1) ** 12 * (A / 30) * 0.10
    hoist = 1 - 0.10 * np.exp(-u / 0.015)        # slight shadow at the pole sleeve
    grain = 1 + (rng.standard_normal(col.shape[:2]).astype(np.float32) * 0.012)
    col = col * (shade * hoist * grain)[..., None] + spec[..., None]
    col = np.clip(col, 0, 1)
    # soft drop shadow onto the sky
    sh = cv2.GaussianBlur(cov, (0, 0), 14 * S / 5.7)
    sh = np.roll(np.roll(sh, int(14 * S), 0), int(10 * S), 1)
    sh[:int(14 * S)] = 0
    sh[:, :int(10 * S)] = 0
    reg = img[y0:y1, x0:x1]
    reg *= (1 - 0.18 * sh)[..., None]
    a = cov[..., None]
    img[y0:y1, x0:x1] = reg * (1 - a) + col * a


def draw_pole(img):
    px, r, ytop = 112, 7.5, 585
    x0, x1 = int((px - r) * S), int((px + r) * S) + 1
    y0 = int(ytop * S)
    t = (np.arange(x0, x1, dtype=np.float32) / S - px) / r          # -1..1
    a = np.clip((1 - np.abs(t)) * r * S, 0, 1)
    n = np.sqrt(np.clip(1 - t ** 2, 0, 1))
    lum = 0.42 + 0.48 * n + 0.45 * np.exp(-((t + 0.35) / 0.18) ** 2)
    c = np.stack([lum * 0.93, lum * 0.95, lum], -1)
    seg = img[y0:, x0:x1]
    img[y0:, x0:x1] = seg * (1 - a[None, :, None]) + np.clip(c, 0, 1)[None] * a[None, :, None]
    # gold finial
    cx, cy, rr = px, ytop - 14, 15
    bx0, bx1, by0, by1 = int((cx - rr - 2) * S), int((cx + rr + 2) * S), int((cy - rr - 2) * S), int((cy + rr + 2) * S)
    yy, xx = np.mgrid[by0:by1, bx0:bx1].astype(np.float32) / S
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rr
    a = np.clip((1 - d) * rr * S, 0, 1)[..., None]
    nz = np.sqrt(np.clip(1 - d ** 2, 0, 1))
    hl = np.exp(-(((xx - cx + 5) ** 2 + (yy - cy + 6) ** 2) / 30))
    c = GOLD * (0.35 + 0.75 * nz)[..., None] + hl[..., None] * 0.6
    img[by0:by1, bx0:bx1] = img[by0:by1, bx0:bx1] * (1 - a) + np.clip(c, 0, 1) * a
    # sleeve rings
    for ry in (604, 1043):
        rx0, rx1, ry0, ry1 = int((px - 10) * S), int((px + 12) * S), int((ry - 3) * S), int((ry + 3) * S)
        img[ry0:ry1, rx0:rx1] = img[ry0:ry1, rx0:rx1] * 0.25 + np.array([0.80, 0.82, 0.86], np.float32) * 0.75


# ---------------------------------------------------------------- overlays (text, logo)
def font(p, size):
    return ImageFont.truetype(p, int(round(size * S)))


FEAT = ['lnum', 'kern', 'liga']


def text_w(f, s, track=0):
    if not track:
        return f.getlength(s, features=FEAT)
    return sum(f.getlength(ch, features=FEAT) for ch in s) + track * S * (len(s) - 1)


def draw_text(d, xy, s, f, fill, track=0, anchor='ls'):
    x, y = xy
    if not track:
        d.text((x, y), s, font=f, fill=fill, anchor=anchor, features=FEAT)
        return
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, anchor=anchor, features=FEAT)
        x += f.getlength(ch, features=FEAT) + track * S


def composite(img, layer, shadow=None):
    lay = np.asarray(layer, np.float32) / 255
    a = lay[..., 3:4]
    if shadow:
        blur, off, op = shadow
        small = cv2.resize(lay[..., 3], (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), blur * S / 4)
        sh = up(small)
        sh = np.roll(sh, int(off * S), 0)
        img *= (1 - op * np.clip(sh, 0, 1))[..., None]
    return img * (1 - a) + lay[..., :3] * a


def overlays(img):
    # ---- text layer
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    white = (255, 255, 255, 255)
    # university wordmark next to the logo (top-left)
    fu = font(F_SEMI, 25)
    draw_text(d, (232 * S, 120 * S), 'TERMIZ DAVLAT', fu, white, track=3.2)
    draw_text(d, (232 * S, 156 * S), 'UNIVERSITETI', fu, white, track=3.2)
    d.rectangle([232 * S, 176 * S, 290 * S, 179 * S], fill=(255, 214, 130, 255))
    # date
    ft = font(F_TITLE, 178)
    s = '18-noyabr'
    tw = text_w(ft, s)
    draw_text(d, ((1080 * S - tw) / 2, 410 * S), s, ft, white)
    # subtitle
    fs = font(F_SEMI, 36)
    for i, line in enumerate([f'O{OK}zbekiston Respublikasi Davlat bayrog{OK}i',
                              'qabul qilinganligining 35 yilligi muborak!']):
        w = text_w(fs, line)
        draw_text(d, ((1080 * S - w) / 2, (480 + i * 48) * S), line, fs, white)
    # footer pill
    ff = font(F_SEMI, 24)
    s = '1991  •  2026'
    w = text_w(ff, s, track=4)
    pw, ph, py = w / S + 64, 50, 1262
    d.rounded_rectangle([(540 - pw / 2) * S, py * S, (540 + pw / 2) * S, (py + ph) * S], radius=ph / 2 * S,
                        fill=(10, 86, 190, 235))
    draw_text(d, ((1080 * S - w) / 2, (py + 34) * S), s, ff, white, track=4)
    img = composite(img, L, shadow=(10, 3, 0.28))

    # ---- logo badge (top-left corner)
    cx, cy, R = 132, 132, 88
    B = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(B)
    bd.ellipse([(cx - R) * S, (cy - R) * S, (cx + R) * S, (cy + R) * S], fill=(255, 255, 255, 255))
    img = composite(img, B, shadow=(14, 6, 0.30))
    logo = Image.open(f'{ROOT}/assets/logo_terdu.png').convert('RGBA')
    size = int(round(2 * (R - 3) * S))
    logo = logo.resize((size, size), Image.LANCZOS)
    LL = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    LL.alpha_composite(logo, (int(round((cx * S) - size / 2)), int(round((cy * S) - size / 2))))
    img = composite(img, LL)
    # thin gold ring around the badge
    yy, xx = np.mgrid[int((cy - R - 6) * S):int((cy + R + 6) * S), int((cx - R - 6) * S):int((cx + R + 6) * S)]
    dist = np.sqrt((xx / S - cx) ** 2 + (yy / S - cy) ** 2)
    ring = np.clip(1 - np.abs(dist - (R + 3)) * S / (1.6 * S), 0, 1)[..., None].astype(np.float32)
    reg = img[yy[0, 0]:yy[-1, 0] + 1, xx[0, 0]:xx[0, -1] + 1]
    img[yy[0, 0]:yy[-1, 0] + 1, xx[0, 0]:xx[0, -1] + 1] = reg * (1 - ring) + GOLD * ring
    return img


def ornaments(img):
    """Gold rule with a small diamond under the title."""
    yc = 440
    for side in (-1, 1):
        x_in, x_out = 540 + side * 22, 540 + side * 150
        xa, xb = sorted([x_in, x_out])
        xs = np.arange(int(xa * S), int(xb * S))
        fade = 1 - np.abs(xs / S - x_in) / 128
        y0, y1 = int((yc - 1) * S), int((yc + 1) * S)
        a = np.clip(fade, 0, 1)[None, :, None] * 0.95
        img[y0:y1, xs[0]:xs[-1] + 1] = img[y0:y1, xs[0]:xs[-1] + 1] * (1 - a) + GOLD * a
    r = 8
    yy, xx = np.mgrid[int((yc - r - 1) * S):int((yc + r + 1) * S), int((540 - r - 1) * S):int((540 + r + 1) * S)]
    dist = (np.abs(xx / S - 540) + np.abs(yy / S - yc)) / r
    a = np.clip((1 - dist) * r * S * 0.7, 0, 1)[..., None].astype(np.float32)
    sl = (slice(yy[0, 0], yy[-1, 0] + 1), slice(xx[0, 0], xx[0, -1] + 1))
    img[sl] = img[sl] * (1 - a) + GOLD * a
    return img


def main():
    img = sky()
    img = clouds(img)
    draw_pole(img)
    draw_flag(img)
    img = ornaments(img)
    img = overlays(img)
    # tiny dither to kill banding in the sky gradient
    img = img + (rng.random(img.shape[:2], dtype=np.float32)[..., None] - 0.5) / 255
    out = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
    im = Image.fromarray(out, 'RGB')
    im.save(OUT, optimize=False, compress_level=6)
    if OUT.endswith('.png'):
        im.save(OUT[:-4] + '.jpg', quality=95, subsampling=0)
    print('saved', OUT, im.size)


if __name__ == '__main__':
    main()
