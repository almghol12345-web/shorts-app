"""The channel's narrator: an original round-headed cartoon character with big
expressive eyes and thick black outlines, wearing a dark-red hoodie (the
channel colour). Drawn in code, so he looks identical in every video.

He is a small rig of separate parts so the animation can be smooth:
  body(arm)   torso + arms; the right arm raises continuously (0..1)
  head(...)   mouth openness (0..1), eyelids (0..1), pupil offset, brow lift
Each part is drawn at 3x and downscaled for clean edges, and cached.
"""
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter

W, H = 560, 900          # canvas (character from the hips up)
SS = 3                    # supersampling factor
HEAD_DROP = 45            # how far the head sits down into the hood
HEAD_H = 520              # head layer height
HEAD_PIVOT = (280, 470)   # neck point the head tilts around (in head-layer pixels)

MOUTH_STEPS = 8
LID_STEPS = 4
ARM_STEPS = 16
PUPIL_STEP = 4            # pixels per pupil grid step (grid -2..2)

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
TEETH = (252, 250, 244)


def _s(points):
    return [(x * SS, y * SS) for x, y in points]


def _b(x0, y0, x1, y1):
    return (x0 * SS, y0 * SS, x1 * SS, y1 * SS)


def _lerp(a, b, t):
    return a + (b - a) * t


def _limb(d, points, width, fill, outline_w):
    """A smooth rounded sleeve: an ink stroke with the fabric stroke on top."""
    pts = _s(points)
    for colour, w in ((INK, width + 2 * outline_w), (fill, width)):
        d.line(pts, fill=colour, width=int(w * SS), joint="curve")
        for x, y in (pts[0], pts[-1]):
            r = w * SS / 2
            d.ellipse((x - r, y - r, x + r, y + r), fill=colour)


def _shrink(img: Image.Image, size) -> Image.Image:
    return img.resize(size, Image.LANCZOS)


# ---------------------------------------------------------------- body

@lru_cache(maxsize=None)
def body(arm_step: int = 0) -> Image.Image:
    """Torso and arms. arm_step 0 = hand down, ARM_STEPS-1 = finger raised high."""
    t = arm_step / (ARM_STEPS - 1)
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ow, thin = 7 * SS, 5 * SS

    outline = _s([(140, 520), (420, 520), (470, 600), (490, 900), (70, 900), (90, 600)])
    d.polygon(outline, fill=HOODIE)
    d.polygon(_s([(330, 525), (420, 520), (470, 600), (490, 900), (360, 900)]), fill=HOODIE_SHADE)
    d.polygon(outline, outline=INK, width=ow)
    d.ellipse(_b(195, 470, 365, 556), fill=HOODIE_DARK, outline=INK, width=ow)          # hood
    d.rounded_rectangle(_b(190, 760, 370, 860), radius=30 * SS, fill=HOODIE_SHADE, outline=INK, width=thin)
    for x in (245, 315):                                                                # drawstrings
        d.line(_s([(x, 560), (x - 4, 660)]), fill=STRING, width=7 * SS)
        d.ellipse(_b(x - 12, 652, x + 4, 670), fill=STRING, outline=INK, width=2 * SS)

    _limb(d, [(130, 560), (112, 680), (118, 780)], 62, HOODIE, 7)                     # left arm
    d.ellipse(_b(88, 765, 152, 829), fill=HEAD, outline=INK, width=ow)

    # right arm: interpolate elbow and hand between "down" and "finger raised"
    elbow = (_lerp(448, 482, t), _lerp(680, 640, t))
    hand = (_lerp(442, 506, t), _lerp(797, 479, t))
    _limb(d, [(430, 560), elbow, hand], 62, HOODIE, 7)
    if t > 0.45:                                                                         # finger grows in
        grow = min(1.0, (t - 0.45) / 0.4)
        top = hand[1] - 30 - 50 * grow
        d.rounded_rectangle(_b(hand[0] - 9, top, hand[0] + 17, hand[1] - 10), radius=13 * SS,
                            fill=HEAD, outline=INK, width=thin)
    d.ellipse(_b(hand[0] - 34, hand[1] - 34, hand[0] + 34, hand[1] + 34), fill=HEAD, outline=INK, width=ow)
    return _shrink(img, (W, H))


# ---------------------------------------------------------------- head

@lru_cache(maxsize=None)
def head(mouth_step: int = 0, lid_step: int = 0, pupil: tuple = (0, 0), brow_step: int = 0) -> Image.Image:
    """mouth_step 0 = closed smile .. MOUTH_STEPS-1 = wide open; lid_step 0 = eyes open ..
    LID_STEPS-1 = closed; pupil = grid offset (-2..2, -2..2); brow_step 0..2 = lift."""
    img = Image.new("RGBA", (W * SS, HEAD_H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ow, thin = 7 * SS, 5 * SS
    cx, cy, r = 280, 285, 200

    face = _b(cx - r, cy - r + 10, cx + r, cy + r - 10)
    d.ellipse(face, fill=HEAD)
    shade = Image.new("L", img.size, 0)
    sd = ImageDraw.Draw(shade)
    sd.ellipse(face, fill=255)
    sd.ellipse(_b(cx - r - 20, cy - r - 10, cx + r - 45, cy + r - 30), fill=0)
    img.paste(Image.new("RGBA", img.size, HEAD_SHADE + (255,)), (0, 0), shade)
    d.ellipse(face, outline=INK, width=ow)
    d.ellipse(_b(150, 365, 200, 390), fill=BLUSH)
    d.ellipse(_b(360, 365, 410, 390), fill=BLUSH)

    # eyes with an eyelid that slides down (smooth blinks)
    lid = lid_step / (LID_STEPS - 1)
    dx, dy = pupil[0] * PUPIL_STEP, pupil[1] * PUPIL_STEP
    for ex in (210, 350):
        top, bottom = 215, 350
        if lid >= 0.99:
            d.arc(_b(ex - 50, 255, ex + 50, 315), 20, 160, fill=INK, width=8 * SS)
            continue
        eye = _b(ex - 58, top, ex + 58, bottom)
        d.ellipse(eye, fill=EYE_WHITE)
        px = ex + (8 if ex < 280 else -8) + dx
        d.ellipse(_b(px - 25, 262 + dy, px + 25, 330 + dy), fill=INK)
        d.ellipse(_b(px - 14, 272 + dy, px - 2, 286 + dy), fill=EYE_WHITE)
        if lid > 0:
            # eyelid: skin covering the top part of the eye, clipped to the eye shape
            cover = Image.new("L", img.size, 0)
            cd = ImageDraw.Draw(cover)
            cd.ellipse(eye, fill=255)
            cut = top + (bottom - top) * lid * 0.95
            cd.rectangle(_b(ex - 60, cut, ex + 60, bottom + 5), fill=0)
            img.paste(Image.new("RGBA", img.size, HEAD + (255,)), (0, 0), cover)
            d.line(_s([(ex - 54, cut), (ex + 54, cut)]), fill=INK, width=6 * SS)
        d.ellipse(eye, outline=INK, width=ow)

    lift = brow_step * 7
    d.line(_s([(160, 192 - lift), (210, 178 - lift * 1.3), (255, 188 - lift)]), fill=INK, width=10 * SS, joint="curve")
    d.line(_s([(305, 188 - lift), (350, 178 - lift * 1.3), (400, 192 - lift)]), fill=INK, width=10 * SS, joint="curve")

    # mouth: from a small smile to wide open, with teeth and tongue as it opens
    o = mouth_step / (MOUTH_STEPS - 1)
    if o == 0:
        d.arc(_b(255, 365, 305, 400), 20, 160, fill=INK, width=6 * SS)
    else:
        w = _lerp(22, 32, o)
        h = _lerp(8, 34, o)
        mx, my = 280, 382
        box = _b(mx - w, my - h * 0.35, mx + w, my + h)
        d.ellipse(box, fill=MOUTH)
        if o > 0.3:
            d.chord(_b(mx - w * 0.75, my - h * 0.35, mx + w * 0.75, my + h * 0.2), 180, 360, fill=TEETH)
        if o > 0.45:
            d.chord(_b(mx - w * 0.6, my + h * 0.25, mx + w * 0.6, my + h * 0.95), 180, 360, fill=TONGUE)
        d.ellipse(box, outline=INK, width=thin)
    return _shrink(img, (W, HEAD_H))


# ---------------------------------------------------------------- full figure

def compose(arm_step=0, mouth_step=0, lid_step=0, pupil=(0, 0), brow_step=0,
            tilt=0.0, nod=0.0) -> Image.Image:
    """Body plus head, the head tilted (degrees) and nodded (pixels) around the neck."""
    fig = body(arm_step).copy()
    h = head(mouth_step, lid_step, pupil, brow_step)
    if abs(tilt) > 0.05:
        h = h.rotate(tilt, resample=Image.BICUBIC, center=HEAD_PIVOT)
    fig.alpha_composite(h, (0, int(HEAD_DROP + nod)))
    return fig


@lru_cache(maxsize=1)
def _shadow_kernel():
    return ImageFilter.GaussianBlur(12)


def with_shadow(fig: Image.Image) -> Image.Image:
    shadow = Image.new("RGBA", fig.size, (0, 0, 0, 0))
    shadow.putalpha(fig.getchannel("A").point(lambda a: int(a * 0.5)))
    shadow = shadow.filter(_shadow_kernel())
    out = Image.new("RGBA", (fig.width + 20, fig.height), (0, 0, 0, 0))
    out.alpha_composite(shadow, (16, 0))
    out.alpha_composite(fig, (0, 0))
    return out


@lru_cache(maxsize=None)
def pose(mouth: int = 0, blink: bool = False, arm_up: bool = False) -> Image.Image:
    """A still pose (for thumbnails and tests): mouth 0/1/2."""
    return with_shadow(compose(arm_step=ARM_STEPS - 1 if arm_up else 0,
                               mouth_step={0: 0, 1: 3, 2: MOUTH_STEPS - 1}[mouth],
                               lid_step=LID_STEPS - 1 if blink else 0))
