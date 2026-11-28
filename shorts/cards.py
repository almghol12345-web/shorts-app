"""Motion-graphic shots drawn in code: the channel's look for every explainer (owner, 28 Nov).

Same family as the eye-challenge videos: warm cream screens (a dark warm one to open), a row
of progress segments at the top, an orange label pill and one white card that carries the
idea of the line: a big number counting up, bars that grow, chips that pop in, a grid of dots,
or a short headline. No paid drawings and no stock footage, so a video costs nothing and every
picture matches what is being said.

A shot is described by a "card:" visual in data/requests.json, for example
    card:{"t": "number", "value": 1392, "unit": "مليار ريال", "label": "مصروفات الميزانية"}

Types: title, number, compare, list, dots, question.
"""
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

from . import icons, quiz
from .quiz import (CARD, GREEN, INK, ORANGE, PILL, RED, SOFT_INK, TILE, _background, _font, _pill,
                   _text, arabic_number)

FPS = 30
CARD_BOX = (90, 420, 990, 1190)     # clear of the captions (68% of the height) and the buttons
TITLE_FONT = "Lalezar-Regular.ttf"
LIGHT = (246, 236, 224)


def _ease(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def _pop(x: float) -> float:
    """0 -> 1 with a small overshoot, for things that pop in."""
    x = min(1.0, max(0.0, x))
    return 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2 if x < 1 else 1.0


def arabic_amount(n: float, decimals: int = 0) -> str:
    """1392 -> ١٬٣٩٢ (Arabic digits, Arabic thousands mark)."""
    text = f"{n:,.{decimals}f}".replace(",", "٬").replace(".", "٫")
    return "".join(quiz.DIGITS[int(c)] if c.isdigit() else c for c in text)


def _wrap(text: str, size: int, width: float, name: str = "NotoSansArabic-Black.ttf") -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if cur and _font(size, name).getlength(trial) > width:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    return lines + ([cur] if cur else [])


def _fit(text: str, size: int, width: float, max_lines: int, name: str) -> tuple[list[str], int]:
    while size > 30:
        lines = _wrap(text, size, width, name)
        if len(lines) <= max_lines:
            return lines, size
        size -= 6
    return _wrap(text, size, width, name), size


def _segments(d: ImageDraw.ImageDraw, steps: int, step: int, dark: bool) -> None:
    if steps < 2:
        return
    x0, x1, gap, y = 160, 920, 12, 200
    seg = (x1 - x0 - gap * (steps - 1)) / steps
    for i in range(steps):
        x = x1 - (i + 1) * seg - i * gap
        done = (250, 196, 120) if not dark else (150, 100, 60)
        rest = (226, 214, 200) if not dark else (70, 56, 48)
        d.rounded_rectangle((x, y, x + seg, y + 12), 6, fill=ORANGE if i == step else done if i < step else rest)


def _frame(spec: dict, t: float) -> Image.Image:
    dark = bool(spec.get("dark"))
    img = _background(dark=dark)
    d = ImageDraw.Draw(img)
    _segments(d, int(spec.get("steps", 0)), int(spec.get("step", 0)), dark)
    tag = spec.get("tag")
    if tag:
        _pill(d, 540, 320, tag, 44, PILL, INK)
    x0, y0, x1, y1 = CARD_BOX
    # the card slides up and fades in during the first 0.35 s
    k = _ease(t / 0.35)
    shift = int((1 - k) * 60)
    box = (x0, y0 + shift, x1, y1 + shift)
    if spec["t"] != "dots" or not dark:
        quiz._card(img, box) if not dark else d.rounded_rectangle(box, 40, fill=(40, 30, 25))
    d = ImageDraw.Draw(img)
    ink, soft = (LIGHT, (200, 186, 170)) if dark else (INK, SOFT_INK)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2 + shift
    inner = x1 - x0 - 110
    kind = spec["t"]

    icon = spec.get("icon")
    if kind == "title":
        lines, size = _fit(spec["text"], int(spec.get("size", 110)), inner, 3, TITLE_FONT)
        sub = spec.get("sub", "")
        sub_lines, sub_size = _fit(sub, 52, inner, 2, "NotoSansArabic-Black.ttf") if sub else ([], 0)
        block = len(lines) * size * 1.15 + (len(sub_lines) * sub_size * 1.4 + 30 if sub_lines else 0)
        top = cy
        if icon:
            iy = y0 + shift + 190
            icons.paste(img, icon, cx, iy, 250, _pop(t / 0.45))
            icons.sparkles(d, cx, iy, 190, t)
            top = (iy + 150 + y1 + shift) / 2
        y = top - block / 2 + size * 0.55
        colour = ORANGE if spec.get("orange", True) else ink
        for line in lines:
            _text(d, (cx, y), line, size, colour, name=TITLE_FONT)
            y += size * 1.15
        y += 30 - size * 0.55 + sub_size * 0.6
        for line in sub_lines:
            if t > 0.25:
                _text(d, (cx, y), line, sub_size, soft)
            y += sub_size * 1.4

    elif kind == "number":
        value = float(spec["value"])
        shown = value * _ease((t - 0.15) / 1.1)
        dec = int(spec.get("decimals", 0))
        label = spec.get("label", "")
        label_y = y0 + shift + 110
        if icon:
            iy = y0 + shift + 150
            icons.paste(img, icon, cx, iy, 190, _pop(t / 0.45))
            icons.sparkles(d, cx, iy, 150, t)
            label_y = iy + 180
        if label:
            for i, line in enumerate(_fit(label, 56, inner, 2, "NotoSansArabic-Black.ttf")[0]):
                _text(d, (cx, label_y + i * 78), line, 56, soft)
        number = spec.get("prefix", "") + arabic_amount(shown, dec)
        size = int(spec.get("size", 210))
        while _font(size, TITLE_FONT).getlength(number) > inner and size > 80:
            size -= 10
        _text(d, (cx, cy + (90 if icon else 10)), number, size, ORANGE, name=TITLE_FONT)
        unit = spec.get("unit", "")
        if unit:
            _pill(d, cx, y1 + shift - 95, unit, 52, (255, 238, 214) if not dark else TILE, ink, pad=50)

    elif kind == "compare":
        items = spec["items"]
        top = max(float(v) for _, v in items) or 1
        colours = [PILL, ORANGE, RED, GREEN]
        title = spec.get("title", "")
        if title:
            _text(d, (cx, y0 + shift + 95), title, 54, soft)
        row_h = (y1 - y0 - (190 if title else 90)) / len(items)
        for i, (label, v) in enumerate(items):
            ry = y0 + shift + (170 if title else 70) + row_h * i
            grow = _ease((t - 0.2 - i * 0.25) / 0.8)
            names = spec.get("icons") or []
            label_x = x1 - 60
            if i < len(names):
                icons.paste(img, names[i], x1 - 110, ry + 30, 100, _pop((t - i * 0.2) / 0.4))
                label_x = x1 - 185
            _text(d, (label_x, ry + 40), label, 50, ink, anchor="rm")
            bar_w = (inner - 230) * float(v) / top * grow
            d.rounded_rectangle((x1 - 60 - bar_w, ry + 85, x1 - 60, ry + 155), 30,
                                fill=colours[i % len(colours)])
            if grow > 0.5:
                tag_text = spec.get("fmt", "{}").format(arabic_amount(float(v), int(spec.get("decimals", 0))))
                _text(d, (x1 - 60 - bar_w - 20, ry + 118), tag_text, 46, ink, anchor="rm")

    elif kind == "list" and spec.get("icons"):
        items, names = spec["items"], spec["icons"]
        title = spec.get("title", "")
        if title:
            _text(d, (cx, y0 + shift + 95), title, 58, soft)
        cols = 2 if len(items) > 1 else 1
        rows = math.ceil(len(items) / cols)
        area_top = y0 + shift + (170 if title else 60)
        cw, rh = inner / cols, (y1 + shift - 50 - area_top) / rows
        for i, (item, name) in enumerate(zip(items, names)):
            p = _pop((t - 0.15 - i * 0.2) / 0.4)
            if p <= 0:
                continue
            col, row = i % cols, i // cols
            px = x1 - 55 - cw * col - cw / 2
            py = area_top + rh * row + rh / 2
            tile = [(255, 238, 214), (222, 245, 236), (255, 226, 214), (232, 236, 255)][i % 4]
            d.rounded_rectangle((px - cw / 2 + 14, py - rh / 2 + 10, px + cw / 2 - 14, py + rh / 2 - 10), 34,
                                fill=tile if not dark else TILE)
            icons.paste(img, name, px, py - rh * 0.12, int(min(cw, rh) * 0.5), p)
            _text(d, (px, py + rh * 0.3), item, 50, ink)

    elif kind == "list":
        items = spec["items"]
        title = spec.get("title", "")
        if title:
            _text(d, (cx, y0 + shift + 100), title, 58, soft)
        cols = 2 if len(items) > 3 else 1
        rows = math.ceil(len(items) / cols)
        cell_w = inner / cols
        area_top = y0 + shift + (190 if title else 90)
        row_h = (y1 + shift - 70 - area_top) / rows
        for i, item in enumerate(items):
            p = _pop((t - 0.2 - i * 0.22) / 0.35)
            if p <= 0:
                continue
            col, row = i % cols, i // cols
            px = x1 - 55 - cell_w * col - cell_w / 2
            py = area_top + row_h * row + row_h / 2
            size = int(56 * min(p, 1.15))
            w = _font(size).getlength(item) + 80
            colour = [(255, 238, 214), (222, 245, 236), (255, 226, 214), (232, 236, 255)][i % 4]
            d.rounded_rectangle((px - w / 2, py - size * 0.9, px + w / 2, py + size * 0.9), size * 0.9,
                                fill=colour if not dark else TILE)
            _text(d, (px, py - size * 0.08), item, size, ink)

    elif kind == "dots":
        cols, rows = int(spec.get("cols", 10)), int(spec.get("rows", 10))
        label = spec.get("label", "")
        area = (x0 + 70, y0 + shift + 70, x1 - 70, y1 + shift - (170 if label else 70))
        cell = min((area[2] - area[0]) / cols, (area[3] - area[1]) / rows)
        gx = (area[0] + area[2]) / 2 - cell * cols / 2
        total = cols * rows
        lit = int(total * _ease((t - 0.1) / 1.2))
        hot = spec.get("highlight")
        for n in range(total):
            r, c = divmod(n, cols)
            x = gx + cell * (cols - 1 - c) + cell / 2
            y = area[1] + cell * r + cell / 2
            rad = cell * 0.36
            colour = (ORANGE if n == hot else (60, 50, 44) if not dark else LIGHT) if n < lit else \
                ((232, 222, 210) if not dark else (70, 56, 48))
            if spec.get("people"):
                h = cell * 0.82
                icons._person(d, x, y - h / 2, h, colour)
            else:
                d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=colour)
        if label:
            _text(d, (cx, y1 + shift - 100), label, 56, ink)

    elif kind == "question":
        p = _pop(t / 0.4)
        r = 150 * p
        qy = y0 + shift + 260
        d.ellipse((cx - r, qy - r, cx + r, qy + r), fill=ORANGE)
        if p > 0.3:
            _text(d, (cx, qy - 20), "؟", int(230 * min(p, 1.1)), (255, 255, 255), name=TITLE_FONT)
        if icon:
            icons.paste(img, icon, cx + 230, qy + 90, 150, _pop((t - 0.2) / 0.4))
        lines, size = _fit(spec["text"], 70, inner, 3, "NotoSansArabic-Black.ttf")
        for i, line in enumerate(lines):
            if t > 0.3:
                _text(d, (cx, qy + 260 + i * size * 1.3), line, size, ink)
    return img


def card_clip(raw: str, seconds: float, out: Path, width: int, height: int, step: int | None = None) -> None:
    """Render one card shot. `raw` is the JSON after "card:"."""
    spec = json.loads(raw)
    if step is not None and "step" not in spec:
        spec["step"] = step
    frames = max(1, int(round(seconds * FPS)))
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{quiz.W}x{quiz.H}",
         "-r", str(FPS), "-i", "-", "-vf", f"scale={width}:{height}", "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "18", "-pix_fmt", "yuv420p", "-an", str(out)], stdin=subprocess.PIPE)
    # every entrance animation ends by 1.6 s; after that a short loop keeps the twinkles alive
    loop = int(round(2 * math.pi / 5 * FPS))       # one sparkle pulse (see icons.sparkles)
    idle: list[bytes] = []
    for i in range(frames):
        t = i / FPS
        if t < 1.6:
            data = _frame(spec, t).tobytes()
        else:
            k = (i - int(1.6 * FPS)) % loop
            if len(idle) <= k:
                idle.append(_frame(spec, 1.6 + k / FPS).tobytes())
            data = idle[k]
        ff.stdin.write(data)
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg could not write a card shot")
