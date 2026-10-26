"""The channel's narrator: an original round-headed cartoon character with big
expressive eyes and thick black outlines, wearing a dark-red hoodie (the
channel colour). Drawn in code, so he looks identical in every video.

Poses combine mouth (0 closed, 1 half, 2 open), eyes (open/blink) and arm
(down/raised). Each pose is drawn once at 3x and downscaled for smooth edges.
"""
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter

W, H = 560, 900          # pose canvas (character from the hips up)
SS = 3                    # supersampling factor
HEAD_DROP = 45            # how far the head sits down into the hood

INK = (24, 22, 22)
HEAD = (240, 226, 200)
HEAD_SHADE = (222, 202, 170)
BLUSH = (242, 178, 160)
EYE_WHITE = (255, 255, 255)
HOODIE = (138, 28, 36)
HOODIE_SHADE = (108, 20, 28)
HOODIE_DARK = (86, 14, 22)
STRING = (240, 236, 228)
MOUTH = (60, 20, 22)
TONGUE = (214, 92, 96)


def _s(points):
    return [(x * SS, y * SS) for x, y in points]


def _b(x0, y0, x1, y1):
    return (x0 * SS, y0 * SS, x1 * SS, y1 * SS)


def _limb(d, points, width, fill, outline_w):
    """A smooth rounded sleeve: an ink stroke with the fabric stroke on top."""
    pts = _s(points)
    for colour, w in ((INK, width + 2 * outline_w), (fill, width)):
        d.line(pts, fill=colour, width=w * SS, joint="curve")
        for x, y in (pts[0], pts[-1]):
            r = w * SS / 2
            d.ellipse((x - r, y - r, x + r, y + r), fill=colour)


@lru_cache(maxsize=None)
def pose(mouth: int = 0, blink: bool = False, arm_up: bool = False) -> Image.Image:
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ow = 7 * SS          # thick cartoon outline
    thin = 5 * SS

    # ---------- body: hoodie ----------
    body = _s([(140, 520), (420, 520), (470, 600), (490, 900), (70, 900), (90, 600)])
    d.polygon(body, fill=HOODIE, outline=INK, width=ow)
    d.polygon(_s([(330, 525), (420, 520), (470, 600), (490, 900), (360, 900)]), fill=HOODIE_SHADE)
    d.polygon(body, outline=INK, width=ow)
    # hood folded around the neck
    d.ellipse(_b(195, 470, 365, 556), fill=HOODIE_DARK, outline=INK, width=ow)
    # front pocket
    d.rounded_rectangle(_b(190, 760, 370, 860), radius=30 * SS, fill=HOODIE_SHADE, outline=INK, width=thin)
    # drawstrings
    for x in (245, 315):
        d.line(_s([(x, 560), (x - 4, 660)]), fill=STRING, width=7 * SS)
        d.ellipse(_b(x - 12, 652, x + 4, 670), fill=STRING, outline=INK, width=2 * SS)

    # ---------- arms: rounded sleeves, round hands ----------
    _limb(d, [(130, 560), (112, 680), (118, 780)], 62, HOODIE, 7)
    d.ellipse(_b(88, 765, 152, 829), fill=HEAD, outline=INK, width=ow)
    if arm_up:
        # elbow out, forearm up, index finger raised: "listen to this..."
        _limb(d, [(430, 560), (478, 640), (505, 540)], 62, HOODIE, 7)
        d.rounded_rectangle(_b(497, 392, 523, 470), radius=13 * SS, fill=HEAD, outline=INK, width=thin)
        d.ellipse(_b(472, 445, 540, 513), fill=HEAD, outline=INK, width=ow)
    else:
        _limb(d, [(430, 560), (448, 680), (442, 780)], 62, HOODIE, 7)
        d.ellipse(_b(408, 765, 472, 829), fill=HEAD, outline=INK, width=ow)

    # ---------- head (drawn on its own layer, then set down onto the shoulders) ----------
    body_img = img
    img = Image.new("RGBA", body_img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy, r = 280, 285, 200
    face = _b(cx - r, cy - r + 10, cx + r, cy + r - 10)      # nearly a circle, like a ball
    d.ellipse(face, fill=HEAD)
    # soft shade on the right side of the face (crescent)
    shade = Image.new("L", img.size, 0)
    sd = ImageDraw.Draw(shade)
    sd.ellipse(face, fill=255)
    sd.ellipse(_b(cx - r - 20, cy - r - 10, cx + r - 45, cy + r - 30), fill=0)
    img.paste(Image.new("RGBA", img.size, HEAD_SHADE + (255,)), (0, 0), shade)
    d.ellipse(face, outline=INK, width=ow)

    # blush
    d.ellipse(_b(150, 365, 200, 390), fill=BLUSH)
    d.ellipse(_b(360, 365, 410, 390), fill=BLUSH)

    # ---------- eyes: big, round, curious ----------
    for ex in (210, 350):
        if blink:
            d.arc(_b(ex - 50, 270, ex + 50, 330), 200, 340, fill=INK, width=8 * SS)
        else:
            d.ellipse(_b(ex - 58, 215, ex + 58, 350), fill=EYE_WHITE, outline=INK, width=ow)
            px = ex + (8 if ex < 280 else -8)              # pupils look slightly inward
            d.ellipse(_b(px - 25, 262, px + 25, 330), fill=INK)
            d.ellipse(_b(px - 14, 272, px - 2, 286), fill=EYE_WHITE)
    # eyebrows: raised and a little worried, a mystery storyteller
    d.line(_s([(160, 192), (210, 178), (255, 188)]), fill=INK, width=10 * SS, joint="curve")
    d.line(_s([(305, 188), (350, 178), (400, 192)]), fill=INK, width=10 * SS, joint="curve")

    # ---------- mouth ----------
    if mouth == 0:
        d.arc(_b(255, 365, 305, 400), 20, 160, fill=INK, width=6 * SS)
    elif mouth == 1:
        d.chord(_b(255, 370, 305, 410), 0, 180, fill=MOUTH, outline=INK, width=thin)
    else:
        d.ellipse(_b(250, 362, 310, 425), fill=MOUTH, outline=INK, width=thin)
        d.chord(_b(262, 395, 298, 422), 180, 360, fill=TONGUE)

    body_img.alpha_composite(img, (0, HEAD_DROP * SS))
    small = body_img.resize((W, H), Image.LANCZOS)
    # soft drop shadow so he stands out from the scene art
    shadow = Image.new("RGBA", small.size, (0, 0, 0, 0))
    shadow.putalpha(small.getchannel("A").point(lambda a: int(a * 0.5)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    out = Image.new("RGBA", (W + 20, H), (0, 0, 0, 0))
    out.alpha_composite(shadow, (16, 0))
    out.alpha_composite(small, (0, 0))
    return out
