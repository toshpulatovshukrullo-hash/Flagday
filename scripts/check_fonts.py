"""Glyph-coverage check for candidate fonts (§4). Usage: python3 scripts/check_fonts.py fonts_src/*.ttf"""
import sys
from fontTools.ttLib import TTFont
REQ = {"U+02BB ʻ": 0x02BB, "U+2018 ‘": 0x2018, "U+02BC ʼ": 0x02BC, "O": 0x4F, "G": 0x47, "o": 0x6F, "g": 0x67,
       "U+00B7 ·": 0xB7, "-": 0x2D}
REQ.update({str(d): 0x30 + d for d in range(10)})
TEXT = "Oʻzbekiston Respublikasi Davlat bayrogʻi qabul qilinganligining yilligi 18-noyabr · 1991"
for path in sys.argv[1:]:
    f = TTFont(path); cmap = f.getBestCmap()
    missing = [k for k, cp in REQ.items() if cp not in cmap]
    miss_txt = sorted({c for c in TEXT if ord(c) not in cmap and c != " "})
    axes = [a.axisTag + f"{a.minValue:g}-{a.maxValue:g}" for a in f["fvar"].axes] if "fvar" in f else []
    print(f"{path.split('/')[-1]:34s} glyphs={len(cmap):5d} axes={axes} missing={missing or 'none'} text_missing={miss_txt or 'none'}")
