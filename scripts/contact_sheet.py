"""Tile QA stills into one image: python3 scripts/contact_sheet.py out.png img1 img2 ..."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
w = 360; h = max(int(i.height * w / i.width) for i in ims)
cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 22)), (30, 30, 30))
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    hh = int(im.height * w / im.width); sheet.paste(im.resize((w, hh), Image.LANCZOS), (x, y + 22))
    ImageDraw.Draw(sheet).text((x + 6, y + 4), f.split('/')[-1], fill=(255, 255, 0))
sheet.save(out)
