"""Tile screenshots into comparison sheets: one row per theme, one column per screen.
Usage: python sheet.py <shots_dir> <out_dir>"""
import sys, glob, os, json
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
themes = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'src', 'themes.json'), encoding='utf-8'))
SCREENS = ['1today', '2today_scroll', '3suggestions', '4progress', '5nutrients', '6search', '7profile']
W = 360  # thumbnail width
try:
    font = ImageFont.truetype('/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf', 34)
    small = ImageFont.truetype('/usr/share/fonts/dejavu/DejaVuSans.ttf', 22)
except OSError:
    font = small = ImageFont.load_default()

rows = []
for t in themes:
    imgs = [Image.open(p).convert('RGB') for s in SCREENS for p in glob.glob(f'{src}/{t["id"]}_{s}.png')]
    if not imgs:
        continue
    thumbs = [im.resize((W, int(im.height * W / im.width))) for im in imgs]
    h = max(x.height for x in thumbs)
    row = Image.new('RGB', (len(thumbs) * (W + 20) + 20, h + 110), t['C']['bg'])
    d = ImageDraw.Draw(row)
    d.text((20, 18), t['name'], fill=t['C']['ink'], font=font)
    d.text((20, 62), t['description'], fill=t['C']['ink2'], font=small)
    for i, th in enumerate(thumbs):
        row.paste(th, (20 + i * (W + 20), 100))
    row.save(f'{out}/theme_{t["id"]}.png')
    rows.append(row)

if rows:
    sheet = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows)), 'white')
    y = 0
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height
    sheet.save(f'{out}/all_themes.png')
    print('sheets:', len(rows))
