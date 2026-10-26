"""The channel's narrator: a Gulf storyteller in a white thobe, red shemagh and
black agal, drawn with code (no image service needed, identical in every video).

Poses are combinations of mouth (0 closed, 1 half, 2 open), eyes (open/blink)
and arm (down/raised). Each pose is drawn once at 3x and downscaled for smooth
edges, then reused for every frame.
"""
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter

W, H = 520, 900          # pose canvas (character from the knees up)
SS = 3                    # supersampling factor

SKIN = (214, 160, 118)
SKIN_SHADE = (186, 132, 94)
OUTLINE = (34, 24, 20)
HAIR = (38, 27, 22)
THOBE = (244, 243, 238)
THOBE_SHADE = (214, 214, 206)
SHEMAGH_RED = (196, 32, 42)
SHEMAGH_WHITE = (248, 246, 240)
AGAL = (18, 18, 20)
EYE_WHITE = (250, 250, 248)
IRIS = (62, 40, 28)
MOUTH = (90, 30, 30)
TONGUE = (200, 90, 90)
TEETH = (250, 248, 240)


def _s(points):
    return [(x * SS, y * SS) for x, y in points]


def _box(x0, y0, x1, y1):
    return (x0 * SS, y0 * SS, x1 * SS, y1 * SS)


def _checked(size, cell=14):
    """Red-and-white shemagh pattern."""
    pat = Image.new("RGB", size, SHEMAGH_WHITE)
    d = ImageDraw.Draw(pat)
    c = cell * SS
    for y in range(0, size[1], c):
        for x in range(0, size[0], c):
            if (x // c + y // c) % 2 == 0:
                d.rectangle((x + c * 0.2, y + c * 0.2, x + c * 0.8, y + c * 0.8), fill=SHEMAGH_RED)
            else:
                d.rectangle((x + c * 0.4, y + c * 0.4, x + c * 0.6, y + c * 0.6), fill=SHEMAGH_RED)
    return pat


@lru_cache(maxsize=None)
def pose(mouth: int = 0, blink: bool = False, arm_up: bool = False) -> Image.Image:
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ow = 4 * SS  # outline width

    # --- body: thobe (shoulders down to the bottom edge) ---
    body = _s([(110, 470), (410, 470), (450, 560), (470, 900), (50, 900), (70, 560)])
    d.polygon(body, fill=THOBE, outline=OUTLINE, width=ow)
    d.polygon(_s([(300, 480), (410, 470), (450, 560), (470, 900), (330, 900)]), fill=THOBE_SHADE)
    d.line(_s([(260, 470), (260, 900)]), fill=THOBE_SHADE, width=3 * SS)          # placket
    for y in (510, 545, 580):
        d.ellipse(_box(255, y, 265, y + 10), fill=(200, 200, 192))                  # buttons

    # --- left arm (viewer's left) always down ---
    d.polygon(_s([(70, 560), (110, 480), (140, 520), (125, 780), (75, 780)]), fill=THOBE, outline=OUTLINE, width=ow)
    d.ellipse(_box(78, 765, 128, 815), fill=SKIN, outline=OUTLINE, width=ow)

    # --- right arm: down, or raised while explaining ---
    if arm_up:
        # upper arm out to the elbow, forearm up, open palm facing the viewer
        d.polygon(_s([(400, 478), (440, 470), (478, 600), (440, 628)]), fill=THOBE, outline=OUTLINE, width=ow)
        d.polygon(_s([(440, 628), (478, 600), (500, 470), (462, 462)]), fill=THOBE, outline=OUTLINE, width=ow)
        d.ellipse(_box(452, 405, 510, 475), fill=SKIN, outline=OUTLINE, width=ow)
        for i, x in enumerate((455, 468, 481, 494)):
            d.rounded_rectangle(_box(x, 372 + (i % 2) * 6, x + 12, 420), radius=6 * SS, fill=SKIN, outline=OUTLINE, width=3 * SS)
        d.ellipse(_box(452, 405, 510, 475), fill=SKIN)
        d.arc(_box(452, 405, 510, 475), 0, 180, fill=OUTLINE, width=ow)
    else:
        d.polygon(_s([(410, 470), (450, 560), (445, 780), (395, 780), (395, 520)]), fill=THOBE, outline=OUTLINE, width=ow)
        d.ellipse(_box(392, 765, 442, 815), fill=SKIN, outline=OUTLINE, width=ow)

    # --- neck ---
    d.rectangle(_box(225, 400, 295, 480), fill=SKIN_SHADE)

    # --- shemagh falling behind the head onto the shoulders ---
    drape = _s([(150, 190), (370, 190), (420, 470), (330, 520), (260, 470), (190, 520), (100, 470)])
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(drape, fill=255)
    img.paste(_checked(img.size), (0, 0), mask)
    d.polygon(drape, outline=OUTLINE, width=ow)

    # --- face ---
    d.ellipse(_box(170, 175, 350, 420), fill=SKIN, outline=OUTLINE, width=ow)
    d.ellipse(_box(160, 280, 185, 330), fill=SKIN, outline=OUTLINE, width=3 * SS)    # ears
    d.ellipse(_box(335, 280, 360, 330), fill=SKIN, outline=OUTLINE, width=3 * SS)

    # beard and moustache (short Gulf style)
    d.chord(_box(178, 250, 342, 425), 15, 165, fill=HAIR)
    d.ellipse(_box(215, 335, 305, 382), fill=SKIN)                                    # clear the mouth area
    d.polygon(_s([(222, 340), (260, 330), (298, 340), (290, 350), (260, 344), (230, 350)]), fill=HAIR)

    # mouth
    if mouth == 0:
        d.line(_s([(242, 362), (278, 362)]), fill=MOUTH, width=4 * SS)
    elif mouth == 1:
        d.ellipse(_box(242, 353, 278, 375), fill=MOUTH)
        d.rectangle(_box(248, 353, 272, 358), fill=TEETH)
    else:
        d.ellipse(_box(238, 349, 282, 389), fill=MOUTH)
        d.rectangle(_box(246, 349, 274, 355), fill=TEETH)
        d.ellipse(_box(248, 372, 272, 388), fill=TONGUE)

    # nose
    d.line(_s([(260, 290), (252, 322), (264, 324)]), fill=SKIN_SHADE, width=4 * SS)

    # eyes (anime style) and brows
    for cx in (222, 298):
        if blink:
            d.arc(_box(cx - 22, 262, cx + 22, 290), 200, 340, fill=OUTLINE, width=4 * SS)
        else:
            d.ellipse(_box(cx - 22, 254, cx + 22, 292), fill=EYE_WHITE, outline=OUTLINE, width=3 * SS)
            d.ellipse(_box(cx - 12, 258, cx + 12, 290), fill=IRIS)
            d.ellipse(_box(cx - 6, 266, cx + 6, 282), fill=(10, 8, 8))
            d.ellipse(_box(cx - 8, 262, cx - 2, 268), fill=(255, 255, 255))
        d.polygon(_s([(cx - 26, 246), (cx + 24, 240), (cx + 26, 248), (cx - 24, 254)]), fill=HAIR)

    # --- shemagh top over the head, then the agal ---
    top = _s([(150, 250), (160, 160), (200, 118), (260, 108), (320, 118), (360, 160), (370, 250),
              (345, 240), (330, 200), (260, 188), (190, 200), (175, 240)])
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(top, fill=255)
    img.paste(_checked(img.size), (0, 0), mask)
    d.polygon(top, outline=OUTLINE, width=ow)
    # agal: two black cords sitting on the crown, the back half hidden behind the head
    for dy in (0, 14):
        d.arc(_box(160, 126 + dy, 360, 186 + dy), 180, 360, fill=AGAL, width=11 * SS)
        d.arc(_box(160, 126 + dy, 360, 186 + dy), 0, 180, fill=AGAL, width=11 * SS)

    small = img.resize((W, H), Image.LANCZOS)
    # soft drop shadow so he stands out from busy backgrounds
    shadow = Image.new("RGBA", small.size, (0, 0, 0, 0))
    shadow.putalpha(small.getchannel("A").point(lambda a: int(a * 0.55)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    out = Image.new("RGBA", (W + 20, H), (0, 0, 0, 0))
    out.alpha_composite(shadow, (16, 0))
    out.alpha_composite(small, (0, 0))
    return out
