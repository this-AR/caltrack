"""Caltrack icon: a white flame on black. Usage: python tools/make_icon.py <HostGrotesk_700Bold.ttf> assets"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

FONT = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
S = 4096

def bez(p0, p1, p2, p3, n=40):
    return [((1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t*t*p2[0] + t**3*p3[0],
             (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t*t*p2[1] + t**3*p3[1]) for t in [i / n for i in range(n + 1)]]

def path(start, segs):
    pts, cur = [], start
    for c1, c2, end in segs:
        pts += bez(cur, c1, c2, end); cur = end
    return pts

OUTER = path((0.5, 0.86), [
    ((0.69, 0.86), (0.79, 0.72), (0.77, 0.57)),
    ((0.75, 0.43), (0.62, 0.35), (0.60, 0.12)),
    ((0.50, 0.24), (0.42, 0.30), (0.39, 0.40)),
    ((0.35, 0.35), (0.35, 0.30), (0.37, 0.25)),
    ((0.25, 0.37), (0.21, 0.50), (0.23, 0.60)),
    ((0.25, 0.77), (0.36, 0.86), (0.5, 0.86)),
])
INNER = path((0.5, 0.82), [
    ((0.60, 0.82), (0.65, 0.74), (0.63, 0.66)),
    ((0.61, 0.58), (0.54, 0.54), (0.52, 0.44)),
    ((0.46, 0.52), (0.37, 0.58), (0.37, 0.68)),
    ((0.37, 0.77), (0.43, 0.82), (0.5, 0.82)),
])

def icon(size, bg, fg, scale=1.0, text=True, cy=0.40):
    im = Image.new('RGBA', (S, S), bg)
    d = ImageDraw.Draw(im)
    fs = 0.62 * scale  # flame box as a fraction of the canvas
    ox, oy = 0.5 - fs / 2, cy - fs / 2
    tr = lambda pts: [((ox + x * fs) * S, (oy + y * fs) * S) for x, y in pts]
    d.polygon(tr(OUTER), fill=fg)
    d.polygon(tr(INNER), fill=bg if bg else (0, 0, 0, 0))
    if text:
        f = ImageFont.truetype(FONT, int(0.105 * scale * S))
        b = d.textbbox((0, 0), 'Caltrack', font=f)
        d.text((S / 2 - (b[0] + b[2]) / 2, (cy + fs * 0.43) * S + 0.03 * scale * S - b[1]), 'Caltrack', font=f, fill=fg)
    return im.resize((size, size), Image.LANCZOS)

# home screen: the flame alone (Android prints the name under the icon); splash: flame + name
icon(1024, '#000000', '#FFFFFF', text=False, cy=0.5).convert('RGB').save(f'{OUT}/icon.png')
icon(1024, None, '#FFFFFF', scale=0.62, text=False, cy=0.5).save(f'{OUT}/android-icon-foreground.png')  # inside the adaptive safe zone
icon(1024, None, '#FFFFFF', scale=0.62, text=False, cy=0.5).save(f'{OUT}/android-icon-monochrome.png')
Image.new('RGB', (1024, 1024), '#000000').save(f'{OUT}/android-icon-background.png')
icon(512, None, '#FFFFFF').save(f'{OUT}/splash-mark.png')
icon(48, '#000000', '#FFFFFF', text=False, cy=0.5).convert('RGB').save(f'{OUT}/favicon.png')
print('ok')
