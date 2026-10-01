#!/Library/Developer/CommandLineTools/usr/bin/python3
"""Puts Figma screenshots (or any PNGs) side by side in one image.

Replaces the loop get_screenshot → curl → crop → combine by hand.

Usage:
  shots.py OUT.png SOURCE[@x0,y0,x1,y1][=Label] ... [--height N] [--gap N] [--vertical]

SOURCE is the image URL that get_screenshot returns, or a local PNG path.
@x0,y0,x1,y1 crops it (pixels of that image), =Label prints a caption above it.
Every image is scaled to the same height (--height, default: the smallest one,
at most 1100), or the same width with --vertical. Prints the output path and
its size; then read OUT.png to look at it, or send it to the user.

Example:
  shots.py /tmp/x.png "https://…/a.png=1728" "https://…/b.png@0,600,402,874=402"
"""
import argparse
import io
import pathlib
import re
import sys
import time
import urllib.request

from PIL import Image, ImageDraw, ImageFont

SPEC = re.compile(r"^(?P<src>.+?)(?:@(?P<box>\d+,\d+,\d+,\d+))?(?:=(?P<label>.*))?$")
FONTS = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]


def load(src):
    if not re.match(r"https?://", src):
        return Image.open(pathlib.Path(src).expanduser()).convert("RGB")
    # A fresh get_screenshot URL answers 202 with an empty body while it renders.
    for _ in range(30):
        req = urllib.request.Request(src, headers={"User-Agent": "shots.py"})
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            if r.status == 200 and body:
                return Image.open(io.BytesIO(body)).convert("RGB")
        time.sleep(1)
    sys.exit(f"no image after 30 s: {src}")


def font(size):
    for f in FONTS:
        if pathlib.Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("specs", nargs="+")
    ap.add_argument("--height", type=int)
    ap.add_argument("--gap", type=int, default=20)
    ap.add_argument("--vertical", action="store_true")
    a = ap.parse_args()

    items = []
    for s in a.specs:
        m = SPEC.match(s)
        img = load(m["src"])
        if m["box"]:
            img = img.crop(tuple(int(v) for v in m["box"].split(",")))
        items.append((img, m["label"]))

    side = "width" if a.vertical else "height"
    target = a.height or min(min(getattr(i, side) for i, _ in items), 1100)
    scaled = []
    for img, label in items:
        k = target / getattr(img, side)
        scaled.append((img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS), label))

    cap = 28 if any(l for _, l in scaled) else 0
    f = font(16)
    if a.vertical:
        w = max(i.width for i, _ in scaled)
        h = sum(i.height + cap for i, _ in scaled) + a.gap * (len(scaled) - 1)
    else:
        w = sum(i.width for i, _ in scaled) + a.gap * (len(scaled) - 1)
        h = max(i.height for i, _ in scaled) + cap
    out = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(out)
    x = y = 0
    for img, label in scaled:
        if label:
            d.text((x + 4, y + 4), label, fill="black", font=f)
        out.paste(img, (x, y + cap))
        if a.vertical:
            y += img.height + cap + a.gap
        else:
            x += img.width + a.gap
    out.save(a.out)
    print(f"{a.out} {w}x{h}")


if __name__ == "__main__":
    sys.exit(main())
