"""Flat illustrations drawn in code for the card shots (no paid drawings, always on topic).

Each icon is drawn three times larger on its own transparent canvas and scaled down, so the
edges come out smooth. `paste(img, name, cx, cy, size)` puts one on a frame.
"""
import math

from PIL import Image, ImageDraw

GOLD, GOLD_DARK, GOLD_LIGHT = (247, 186, 44), (210, 142, 22), (255, 226, 140)
INK, WHITE, CREAM = (40, 32, 28), (255, 255, 255), (255, 246, 232)
ORANGE, RED, GREEN, BLUE, SKY = (245, 146, 32), (232, 64, 80), (22, 168, 128), (74, 128, 224), (170, 205, 245)
GREY, GREY_DARK = (205, 200, 196), (120, 112, 106)
SS = 3   # supersampling


def _bars(d, s):
    def bar(x, y, w, h):
        d.polygon([(x + h * 0.35, y), (x + w - h * 0.35, y), (x + w, y + h), (x, y + h)], fill=GOLD)
        d.polygon([(x + h * 0.35, y), (x + w - h * 0.35, y), (x + w - h * 0.5, y + h * 0.3),
                   (x + h * 0.5, y + h * 0.3)], fill=GOLD_LIGHT)
        d.line([(x, y + h), (x + w, y + h)], fill=GOLD_DARK, width=int(s * 0.03))
    w, h = s * 0.42, s * 0.2
    bar(s * 0.06, s * 0.62, w, h)
    bar(s * 0.52, s * 0.62, w, h)
    bar(s * 0.29, s * 0.40, w, h)


def _coin(d, s, x=0.5, y=0.5, r=0.4):
    cx, cy, r = s * x, s * y, s * r
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD_DARK)
    d.ellipse((cx - r * 0.92, cy - r * 0.96, cx + r * 0.92, cy + r * 0.86), fill=GOLD)
    d.ellipse((cx - r * 0.66, cy - r * 0.7, cx + r * 0.66, cy + r * 0.6), outline=GOLD_LIGHT, width=int(r * 0.09))
    d.ellipse((cx - r * 0.5, cy - r * 0.78, cx - r * 0.1, cy - r * 0.5), fill=GOLD_LIGHT)


def _coins(d, s):
    for i in range(5):
        y = s * (0.78 - i * 0.11)
        d.ellipse((s * 0.18, y - s * 0.08, s * 0.82, y + s * 0.08), fill=GOLD_DARK)
        d.ellipse((s * 0.18, y - s * 0.12, s * 0.82, y + s * 0.04), fill=GOLD if i % 2 else GOLD_LIGHT)
    _coin(d, s, 0.72, 0.3, 0.2)


def _banknote(d, s):
    for i, off in enumerate((0.1, 0.0)):
        x0, y0 = s * (0.1 + off), s * (0.26 + off)
        d.rounded_rectangle((x0, y0, x0 + s * 0.72, y0 + s * 0.42), s * 0.05,
                            fill=(120, 190, 140) if i == 0 else (70, 160, 110))
    x0, y0 = s * 0.1, s * 0.26
    d.ellipse((x0 + s * 0.26, y0 + s * 0.11, x0 + s * 0.46, y0 + s * 0.31), outline=WHITE, width=int(s * 0.03))
    d.rectangle((x0 + s * 0.05, y0 + s * 0.05, x0 + s * 0.67, y0 + s * 0.37), outline=(190, 230, 200),
                width=int(s * 0.015))


def _clock(d, s):
    c, r = s / 2, s * 0.4
    d.ellipse((c - r, c - r, c + r, c + r), fill=ORANGE)
    d.ellipse((c - r * 0.82, c - r * 0.82, c + r * 0.82, c + r * 0.82), fill=WHITE)
    for k in range(12):
        a = k * math.pi / 6
        d.line([(c + math.cos(a) * r * 0.68, c + math.sin(a) * r * 0.68),
                (c + math.cos(a) * r * 0.76, c + math.sin(a) * r * 0.76)], fill=INK, width=int(s * 0.02))
    d.line([(c, c), (c, c - r * 0.55)], fill=INK, width=int(s * 0.04))
    d.line([(c, c), (c + r * 0.4, c + r * 0.15)], fill=RED, width=int(s * 0.03))
    d.ellipse((c - s * 0.03, c - s * 0.03, c + s * 0.03, c + s * 0.03), fill=INK)


def _hourglass(d, s):
    d.rounded_rectangle((s * 0.22, s * 0.1, s * 0.78, s * 0.17), s * 0.03, fill=GOLD_DARK)
    d.rounded_rectangle((s * 0.22, s * 0.83, s * 0.78, s * 0.9), s * 0.03, fill=GOLD_DARK)
    d.polygon([(s * 0.3, s * 0.17), (s * 0.7, s * 0.17), (s * 0.53, s * 0.5), (s * 0.7, s * 0.83),
               (s * 0.3, s * 0.83), (s * 0.47, s * 0.5)], fill=(225, 238, 250))
    d.polygon([(s * 0.36, s * 0.3), (s * 0.64, s * 0.3), (s * 0.5, s * 0.48)], fill=GOLD)
    d.polygon([(s * 0.5, s * 0.62), (s * 0.66, s * 0.82), (s * 0.34, s * 0.82)], fill=GOLD)
    d.line([(s * 0.5, s * 0.48), (s * 0.5, s * 0.7)], fill=GOLD, width=int(s * 0.015))


def _person(d, x, y, h, colour):
    d.ellipse((x - h * 0.16, y, x + h * 0.16, y + h * 0.32), fill=colour)
    d.rounded_rectangle((x - h * 0.28, y + h * 0.38, x + h * 0.28, y + h), h * 0.2, fill=colour)


def _people(d, s):
    _person(d, s * 0.25, s * 0.32, s * 0.5, (250, 196, 120))
    _person(d, s * 0.75, s * 0.32, s * 0.5, (120, 170, 235))
    _person(d, s * 0.5, s * 0.22, s * 0.62, ORANGE)


def _house(d, s):
    d.polygon([(s * 0.5, s * 0.12), (s * 0.9, s * 0.48), (s * 0.1, s * 0.48)], fill=RED)
    d.rectangle((s * 0.2, s * 0.46, s * 0.8, s * 0.88), fill=CREAM)
    d.rectangle((s * 0.43, s * 0.62, s * 0.57, s * 0.88), fill=ORANGE)
    d.rectangle((s * 0.26, s * 0.55, s * 0.37, s * 0.66), fill=SKY)
    d.rectangle((s * 0.63, s * 0.55, s * 0.74, s * 0.66), fill=SKY)


def _school(d, s):
    d.polygon([(s * 0.5, s * 0.1), (s * 0.92, s * 0.34), (s * 0.08, s * 0.34)], fill=BLUE)
    d.rectangle((s * 0.12, s * 0.34, s * 0.88, s * 0.88), fill=CREAM)
    for i in range(4):
        x = s * (0.2 + i * 0.18)
        d.rectangle((x, s * 0.42, x + s * 0.08, s * 0.82), fill=(225, 214, 200))
    d.rectangle((s * 0.08, s * 0.84, s * 0.92, s * 0.9), fill=GREY_DARK)
    d.line([(s * 0.5, s * 0.1), (s * 0.5, s * 0.0)], fill=INK, width=int(s * 0.02))
    d.polygon([(s * 0.5, s * 0.0), (s * 0.64, s * 0.03), (s * 0.5, s * 0.06)], fill=GREEN)


def _hospital(d, s):
    d.rounded_rectangle((s * 0.14, s * 0.2, s * 0.86, s * 0.9), s * 0.04, fill=WHITE, outline=GREY, width=int(s * 0.02))
    d.rectangle((s * 0.42, s * 0.3, s * 0.58, s * 0.62), fill=RED)
    d.rectangle((s * 0.34, s * 0.38, s * 0.66, s * 0.54), fill=RED)
    for i in range(3):
        x = s * (0.22 + i * 0.22)
        d.rectangle((x, s * 0.7, x + s * 0.12, s * 0.8), fill=SKY)


def _road(d, s):
    d.polygon([(s * 0.38, s * 0.1), (s * 0.62, s * 0.1), (s * 0.95, s * 0.92), (s * 0.05, s * 0.92)], fill=(90, 86, 84))
    for i in range(5):
        y0 = s * (0.14 + i * 0.16)
        w = s * (0.012 + i * 0.008)
        d.polygon([(s * 0.5 - w, y0), (s * 0.5 + w, y0), (s * 0.5 + w * 1.4, y0 + s * 0.09),
                   (s * 0.5 - w * 1.4, y0 + s * 0.09)], fill=GOLD_LIGHT)


def _chart(d, s):
    for i, h in enumerate((0.25, 0.4, 0.55, 0.75)):
        x = s * (0.12 + i * 0.2)
        d.rounded_rectangle((x, s * (0.9 - h), x + s * 0.14, s * 0.9), s * 0.03,
                            fill=[GOLD_LIGHT, GOLD, ORANGE, RED][i])
    d.line([(s * 0.1, s * 0.62), (s * 0.4, s * 0.45), (s * 0.58, s * 0.5), (s * 0.88, s * 0.15)],
           fill=GREEN, width=int(s * 0.04), joint="curve")
    d.polygon([(s * 0.88, s * 0.08), (s * 0.94, s * 0.24), (s * 0.78, s * 0.18)], fill=GREEN)


def _calendar(d, s):
    d.rounded_rectangle((s * 0.12, s * 0.16, s * 0.88, s * 0.88), s * 0.06, fill=WHITE, outline=GREY, width=int(s * 0.02))
    d.rounded_rectangle((s * 0.12, s * 0.16, s * 0.88, s * 0.34), s * 0.06, fill=RED)
    for x in (0.3, 0.7):
        d.rounded_rectangle((s * (x - 0.03), s * 0.08, s * (x + 0.03), s * 0.24), s * 0.02, fill=GREY_DARK)
    for r in range(3):
        for c in range(4):
            x, y = s * (0.2 + c * 0.17), s * (0.42 + r * 0.14)
            d.rounded_rectangle((x, y, x + s * 0.1, y + s * 0.08), s * 0.015,
                                fill=ORANGE if (r, c) == (1, 2) else (236, 230, 222))


def _cube(d, s):
    top = [(s * 0.5, s * 0.12), (s * 0.88, s * 0.32), (s * 0.5, s * 0.52), (s * 0.12, s * 0.32)]
    d.polygon(top, fill=GOLD_LIGHT)
    d.polygon([(s * 0.12, s * 0.32), (s * 0.5, s * 0.52), (s * 0.5, s * 0.92), (s * 0.12, s * 0.72)], fill=GOLD)
    d.polygon([(s * 0.88, s * 0.32), (s * 0.5, s * 0.52), (s * 0.5, s * 0.92), (s * 0.88, s * 0.72)], fill=GOLD_DARK)


def _ring(d, s):
    c = s / 2
    d.ellipse((s * 0.18, s * 0.34, s * 0.82, s * 0.94), outline=GOLD, width=int(s * 0.08))
    d.polygon([(c, s * 0.08), (c + s * 0.14, s * 0.2), (c, s * 0.38), (c - s * 0.14, s * 0.2)], fill=SKY)
    d.polygon([(c, s * 0.08), (c + s * 0.14, s * 0.2), (c, s * 0.2)], fill=WHITE)


def _globe(d, s):
    c, r = s / 2, s * 0.4
    d.ellipse((c - r, c - r, c + r, c + r), fill=BLUE)
    d.ellipse((c - r * 0.5, c - r, c + r * 0.5, c + r), outline=SKY, width=int(s * 0.02))
    d.line([(c, c - r), (c, c + r)], fill=SKY, width=int(s * 0.02))
    for k in (-0.5, 0, 0.5):
        y = c + r * k
        w = math.sqrt(max(0, r * r - (r * k) ** 2))
        d.line([(c - w, y), (c + w, y)], fill=SKY, width=int(s * 0.02))
    d.polygon([(c - r * 0.3, c - r * 0.5), (c + r * 0.1, c - r * 0.6), (c + r * 0.2, c - r * 0.1),
               (c - r * 0.2, c + r * 0.1)], fill=GREEN)


def _gamepad(d, s):
    d.rounded_rectangle((s * 0.08, s * 0.3, s * 0.92, s * 0.74), s * 0.2, fill=(60, 60, 72))
    d.rectangle((s * 0.22, s * 0.47, s * 0.38, s * 0.53), fill=WHITE)
    d.rectangle((s * 0.27, s * 0.42, s * 0.33, s * 0.58), fill=WHITE)
    for (x, y, col) in ((0.7, 0.42, GREEN), (0.78, 0.5, RED), (0.62, 0.5, BLUE), (0.7, 0.58, GOLD)):
        d.ellipse((s * (x - 0.04), s * (y - 0.04), s * (x + 0.04), s * (y + 0.04)), fill=col)


def _phone(d, s):
    d.rounded_rectangle((s * 0.28, s * 0.06, s * 0.72, s * 0.94), s * 0.08, fill=INK)
    d.rounded_rectangle((s * 0.31, s * 0.12, s * 0.69, s * 0.86), s * 0.05, fill=SKY)
    d.rounded_rectangle((s * 0.44, s * 0.08, s * 0.56, s * 0.1), s * 0.01, fill=GREY_DARK)


def _star(d, s):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = s * (0.42 if k % 2 == 0 else 0.18)
        pts.append((s / 2 + math.cos(a) * r, s / 2 + math.sin(a) * r))
    d.polygon(pts, fill=GOLD)


DRAW = {
    "gold": _bars, "coin": _coin, "coins": _coins, "money": _banknote, "clock": _clock,
    "hourglass": _hourglass, "people": _people, "house": _house, "school": _school,
    "hospital": _hospital, "road": _road, "chart": _chart, "calendar": _calendar, "cube": _cube,
    "ring": _ring, "globe": _globe, "gamepad": _gamepad, "phone": _phone, "star": _star,
}


def paste(img: Image.Image, name: str, cx: float, cy: float, size: int, scale: float = 1.0) -> None:
    """Draw icon `name` centred at (cx, cy); `scale` animates it (0..1, may overshoot)."""
    if name not in DRAW or scale <= 0.02:
        return
    big = int(size * SS)
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    DRAW[name](ImageDraw.Draw(canvas), big)
    final = max(2, int(size * scale))
    small = canvas.resize((final, final), Image.LANCZOS)
    # a soft round shadow under the icon
    sh = Image.new("RGBA", (final, final // 4 + 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((final * 0.22, 0, final * 0.78, final // 5), fill=(120, 80, 40, 32))
    img.paste(sh, (int(cx - final / 2), int(cy + final / 2 - final * 0.08)), sh)
    img.paste(small, (int(cx - final / 2), int(cy - final / 2)), small)


def sparkles(d: ImageDraw.ImageDraw, cx: float, cy: float, radius: float, t: float, colour=GOLD) -> None:
    """Little twinkles around an icon: the 'details' that keep a still card alive."""
    for k in range(6):
        a = k * math.pi / 3 + 0.4
        x, y = cx + math.cos(a) * radius, cy + math.sin(a) * radius * 0.8
        pulse = 0.6 + 0.4 * math.sin(t * 5 + k)
        r = 9 * pulse
        d.line([(x - r, y), (x + r, y)], fill=colour, width=4)
        d.line([(x, y - r), (x, y + r)], fill=colour, width=4)
