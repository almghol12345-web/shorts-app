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


def _card_frame(spec: dict, t: float) -> Image.Image:
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
        r = max(1.0, 150 * p)
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


# ---------------------------------------------------------------------------------------------
# Free layouts (owner, 28 Nov: "not always a box with words in it, let everything change"):
# the drawing itself fills the screen, the background colour changes from shot to shot and
# each kind of line has its own composition. "layout": "card" keeps the old boxed look.

PALETTES = {
    "cream": ((253, 243, 228), (246, 222, 190), (255, 214, 150)),
    "peach": ((255, 234, 218), (250, 204, 176), (255, 196, 150)),
    "mint": ((232, 247, 239), (198, 232, 216), (170, 230, 200)),
    "sky": ((233, 242, 253), (198, 218, 246), (180, 210, 255)),
    "sand": ((250, 240, 214), (236, 212, 160), (255, 224, 150)),
}
CYCLE = ["cream", "mint", "peach", "sky", "sand"]
_BG: dict = {}


def _palette_bg(name: str) -> Image.Image:
    if name not in _BG:
        top, bottom, glow_c = PALETTES[name]
        from PIL import ImageFilter
        img = quiz._gradient(top, bottom)
        glow = Image.new("L", (quiz.W, quiz.H), 0)
        ImageDraw.Draw(glow).ellipse((quiz.W * 0.05, -quiz.H * 0.1, quiz.W * 0.95, quiz.H * 0.45), fill=150)
        glow = glow.filter(ImageFilter.GaussianBlur(170))
        img = Image.composite(Image.new("RGB", (quiz.W, quiz.H), glow_c), img, glow)
        d = ImageDraw.Draw(img)
        dot = tuple(max(0, c - 22) for c in bottom)
        for y in range(40, quiz.H, 64):
            for x in range(40, quiz.W, 64):
                d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=dot)
        _BG[name] = img
    return _BG[name].copy()


def _halo(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, colour) -> None:
    if r < 2:
        return
    for k, a in ((1.0, 0.35), (0.78, 0.6)):
        c = tuple(int(255 - (255 - v) * a) for v in colour)
        d.ellipse((cx - r * k, cy - r * k, cx + r * k, cy + r * k), fill=c)


def _big_text(d, cx, y, text, size, colour, width=900, lines_max=2, name=TITLE_FONT, shadow=None):
    lines, size = _fit(text, size, width, lines_max, name)
    for line in lines:
        if shadow:
            _text(d, (cx + 5, y + 6), line, size, shadow, name=name)
        _text(d, (cx, y), line, size, colour, name=name)
        y += size * 1.12
    return y


def _free_frame(spec: dict, t: float) -> Image.Image:
    dark = bool(spec.get("dark"))
    step = int(spec.get("step", 0))
    palette = spec.get("bg") or CYCLE[step % len(CYCLE)]
    img = _background(dark=True) if dark else _palette_bg(palette)
    d = ImageDraw.Draw(img)
    _segments(d, int(spec.get("steps", 0)), step, dark)
    if spec.get("tag"):
        _pill(d, 540, 300, spec["tag"], 40, PILL, INK)
    ink, soft = (LIGHT, (210, 196, 180)) if dark else (INK, SOFT_INK)
    accent = ORANGE
    halo_c = (120, 80, 50) if dark else PALETTES.get(palette, PALETTES["cream"])[2]
    kind, icon, cx = spec["t"], spec.get("icon"), 540
    rise = int((1 - _ease(t / 0.4)) * 50)

    if kind == "title":
        iy = 630
        if icon:
            _halo(d, cx, iy + rise, 270 * _ease(t / 0.4), halo_c)
            icons.paste(img, icon, cx, iy + rise, 400, _pop(t / 0.45))
            icons.sparkles(d, cx, iy, 300, t)
            y = 975
        else:
            y = 760
        y = _big_text(d, cx, y + rise, spec["text"], int(spec.get("size", 118)),
                      accent if dark or spec.get("orange") else ink, shadow=None)
        if spec.get("sub") and t > 0.25:
            _big_text(d, cx, y + 10, spec["sub"], 54, soft, name="NotoSansArabic-Black.ttf")

    elif kind in ("number", "counter"):
        if spec.get("label"):
            _big_text(d, cx, 400, spec["label"], 58, soft, name="NotoSansArabic-Black.ttf")
        if icon:
            _halo(d, cx, 610, 180 * _ease(t / 0.4), halo_c)
            icons.paste(img, icon, cx, 610 + rise, 270, _pop(t / 0.45))
            icons.sparkles(d, cx, 610, 210, t)
        value = float(spec["value"])
        if kind == "counter":                   # a live meter: keeps counting the whole shot
            shown = value * t
        else:
            shown = value * _ease((t - 0.15) / 1.1)
        number = spec.get("prefix", "") + arabic_amount(shown, int(spec.get("decimals", 0)))
        size = int(spec.get("size", 240))
        while _font(size, TITLE_FONT).getlength(number) > 940 and size > 90:
            size -= 10
        ny = 975 if icon else 780
        _text(d, (cx + 6, ny + 8), number, size, (200, 110, 20) if not dark else (90, 50, 20), name=TITLE_FONT)
        _text(d, (cx, ny), number, size, accent, name=TITLE_FONT)
        if spec.get("unit"):
            _pill(d, cx, ny + size * 0.62, spec["unit"], 54, (255, 255, 255) if not dark else TILE, ink, pad=56)
        if kind == "counter" and spec.get("rain"):
            g = __import__("random").Random(7)
            for k in range(14):
                x = g.uniform(80, 1000)
                speed = g.uniform(260, 520)
                y = (g.uniform(0, 1400) + t * speed) % 1500 - 100
                icons.paste(img, spec["rain"], x, y + 150, int(g.uniform(70, 120)))

    elif kind == "compare":
        items = spec["items"]
        names = spec.get("icons") or []
        if spec.get("title"):
            _big_text(d, cx, 400, spec["title"], 60, ink, name="NotoSansArabic-Black.ttf")
        top = max(float(v) for _, v in items) or 1
        n = len(items)
        cw, gap, base, max_h = 230, 90, 1090, 470
        x0 = cx + (n * cw + (n - 1) * gap) / 2
        colours = [PILL, ORANGE, RED, GREEN]
        for i, (label, v) in enumerate(items):
            grow = _ease((t - 0.15 - i * 0.25) / 0.8)
            h = max_h * float(v) / top * grow
            x = x0 - (i + 1) * cw - i * gap
            d.rounded_rectangle((x, base - h, x + cw, base), 36, fill=colours[i % 4])
            d.rounded_rectangle((x + 18, base - h + 18, x + 44, base - 18 if h > 60 else base - h + 30), 13,
                                fill=tuple(min(255, c + 40) for c in colours[i % 4]))
            if grow > 0.3:
                val = spec.get("fmt", "{}").format(arabic_amount(float(v) * grow, int(spec.get("decimals", 0))))
                _text(d, (x + cw / 2, base - h - 60), val, 70, ink, name=TITLE_FONT)
            if i < len(names):
                icons.paste(img, names[i], x + cw / 2, base - h - 170, 130, _pop((t - i * 0.25) / 0.4))
            _text(d, (x + cw / 2, base + 48), label, 50, ink)

    elif kind == "question":
        p = _pop(t / 0.4)
        qy = 650
        _halo(d, cx, qy, 300 * p, halo_c)
        r = max(1.0, 200 * p)
        d.ellipse((cx - r, qy - r, cx + r, qy + r), fill=ORANGE)
        if p > 0.3:
            _text(d, (cx, qy - 26), "؟", int(300 * min(p, 1.1)), (255, 255, 255), name=TITLE_FONT)
        if icon:
            icons.paste(img, icon, cx + 250, qy + 160, 190, _pop((t - 0.2) / 0.4))
        if t > 0.25:
            _big_text(d, cx, 975, spec["text"], 84, ink, name="NotoSansArabic-Black.ttf")

    elif kind == "list":
        items, names = spec["items"], spec.get("icons") or []
        if spec.get("title"):
            _big_text(d, cx, 400, spec["title"], 60, ink, name="NotoSansArabic-Black.ttf")
        cols = 2 if len(items) > 1 else 1
        rows = math.ceil(len(items) / cols)
        top_y, bottom_y = 500, 1190
        rh, cw = (bottom_y - top_y) / rows, 900 / cols
        for i, item in enumerate(items):
            p = _pop((t - 0.15 - i * 0.2) / 0.4)
            if p <= 0:
                continue
            col, row = i % cols, i // cols
            px, py = 990 - cw * col - cw / 2, top_y + rh * row + rh / 2
            if i < len(names):
                _halo(d, px, py - 40, 120 * min(p, 1), halo_c)
                icons.paste(img, names[i], px, py - 40, 190, p)
            _text(d, (px, py + rh * 0.36), item, 56, ink)

    elif kind == "dots":
        cols, rows = int(spec.get("cols", 10)), int(spec.get("rows", 10))
        area = (110, 420, 970, 1120)
        cell = min((area[2] - area[0]) / cols, (area[3] - area[1]) / rows)
        gx = cx - cell * cols / 2
        total = cols * rows
        lit = int(total * _ease((t - 0.1) / 1.2))
        hot = spec.get("highlight")
        for n_ in range(total):
            r_, c_ = divmod(n_, cols)
            x = gx + cell * (cols - 1 - c_) + cell / 2
            y = area[1] + cell * r_ + cell / 2
            colour = (ORANGE if n_ == hot else ink) if n_ < lit else tuple(int(c * 0.85) for c in PALETTES.get(palette, PALETTES["cream"])[1])
            icons._person(d, x, y - cell * 0.4, cell * 0.8, colour)
        if spec.get("label"):
            _big_text(d, cx, 1180, spec["label"], 58, ink, name="NotoSansArabic-Black.ttf")
    return img


def _frame(spec: dict, t: float) -> Image.Image:
    if spec.get("layout") == "card":
        return _card_frame(spec, t)
    return _free_frame(spec, t)


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
        if t < 1.6 or spec["t"] == "counter":
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
