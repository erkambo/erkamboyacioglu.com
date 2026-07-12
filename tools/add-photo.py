#!/usr/bin/env python3
"""Shrink a phone photo for the site and print its photo-wall entry.

    python3 tools/add-photo.py ~/Pictures/IMG_2031.jpg lake
    python3 tools/add-photo.py ~/Downloads/meme.png reaction

Writes images/wall/<name>.jpg and prints the line to paste into WALLS in script.js.
Needs Pillow:  pip install pillow
"""
import os
import sys

from PIL import Image, ImageOps

MAX_WIDTH = 640   # the sidebar shows ~300px; 2x keeps it sharp on retina screens
QUALITY = 82

if len(sys.argv) != 3:
    sys.exit(__doc__)

src, name = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'images', 'wall', f'{name}.jpg')
os.makedirs(os.path.dirname(out), exist_ok=True)

im = Image.open(src)
im = ImageOps.exif_transpose(im)  # phones store rotation in metadata, not pixels

w, h = im.size
if w > MAX_WIDTH:
    im = im.resize((MAX_WIDTH, round(h * MAX_WIDTH / w)), Image.LANCZOS)

im.convert('RGB').save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)

nw, nh = im.size
before = os.path.getsize(src) // 1024
after = os.path.getsize(out) // 1024
print(f'\n{out}')
print(f'  {w}x{h} ({before} KB)  ->  {nw}x{nh} ({after} KB)\n')
print('paste into WALLS in script.js:\n')
print(f"        {{ src: 'images/wall/{name}.jpg', w: {nw}, h: {nh}, caption: '...' }},\n")
