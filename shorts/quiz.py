"""Eye-challenge Shorts: find the odd letter, level after level.

A second kind of video next to the explainers. The viewer plays along: a grid of the same
letter hides one look-alike, a countdown runs, then the answer is circled. Levels get harder,
which is the reason to stay to the end. Everything is drawn in code (no paid drawings, no
voice), so a video costs nothing to make.

    python -m shorts.quiz out.mp4 --seed 7
"""
import argparse
import math
import random
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, features

W, H, FPS = 1080, 1920, 30
FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"

# look-alike pairs (the common letter, the odd one), easiest first
EASY = [("٨", "٧"), ("س", "ش"), ("ب", "ت"), ("ص", "ض")]
MEDIUM = [("ح", "خ"), ("ر", "ز"), ("د", "ذ"), ("ع", "غ"), ("ط", "ظ")]
HARD = [("ي", "ى"), ("ه", "ة"), ("ف", "ق"), ("ا", "أ"), ("ن", "ت")]
# look-alike digits (Latin digits read the same for every Arab viewer)
NUM_EASY = [("6", "9"), ("8", "3"), ("5", "2")]
NUM_MEDIUM = [("6", "8"), ("3", "5"), ("0", "8"), ("1", "7")]
NUM_HARD = [("6", "5"), ("8", "9"), ("0", "6"), ("3", "9"), ("2", "7")]
# colour kind: how much lighter the odd tile is, per level (smaller = harder)
SHADE_STEPS = [0.20, 0.10, 0.055, 0.03, 0.017]
KINDS = {
    "letters": ("الحرف", "وين الحرف الغريب؟"),
    "numbers": ("الرقم", "وين الرقم الغريب؟"),
    "colors": ("المربع", "أي مربع لونه مختلف؟"),
}
# (columns, rows, seconds to look) per level
SHAPES = [(5, 6, 5), (7, 9, 6), (9, 12, 7), (11, 15, 8), (13, 18, 9)]
# letters/numbers: how much each glyph wanders in position and size, per level (camouflage)
JITTER = [0.0, 0.0, 0.05, 0.09, 0.13]

# look of the video: warm cream levels, a dark warm opening (owner's reference, 28 Nov)
CREAM_TOP, CREAM_BOTTOM = (253, 243, 228), (246, 222, 190)
DARK_TOP, DARK_BOTTOM = (44, 32, 26), (16, 13, 12)
CARD, INK, SOFT_INK = (255, 255, 255), (24, 20, 18), (60, 50, 44)
ORANGE, PILL, GREEN, RED = (245, 146, 32), (255, 190, 64), (22, 168, 128), (232, 64, 80)
FADED, TRACK, TILE = (214, 210, 206), (226, 214, 200), (58, 44, 36)
AMBER, MUTED = ORANGE, (150, 140, 130)
DIGITS = "٠١٢٣٤٥٦٧٨٩"
HOOK_S, REVEAL_S, END_S = 2.6, 1.7, 3.2
FILL_S = 0.6                     # the grid draws itself in at the start of a level
LABELS = ["سهل", "متوسط", "صعب", "صعب جدًا", "مستحيل"]
BRAND = "غيهب - تحديات"


@dataclass
class Level:
    common: str
    odd: str
    cols: int
    rows: int
    seconds: int
    at: tuple[int, int]          # (column, row) of the odd letter
    kind: str = "letters"        # letters / numbers / colors
    colour: tuple[int, int, int] = (0, 0, 0)      # colors kind: the common tile colour
    odd_colour: tuple[int, int, int] = (0, 0, 0)  # colors kind: the odd tile colour


def levels(seed: int, kind: str = "letters") -> list[Level]:
    """Five levels, harder each time; the same seed always gives the same video."""
    rng = random.Random(seed)
    if kind == "numbers":
        pairs = [rng.choice(NUM_EASY), *rng.sample(NUM_MEDIUM, 2), *rng.sample(NUM_HARD, 2)]
    else:
        pairs = [rng.choice(EASY), *rng.sample(MEDIUM, 2), *rng.sample(HARD, 2)]
    hue = rng.random()
    out = []
    for i, ((common, odd), (cols, rows, seconds)) in enumerate(zip(pairs, SHAPES)):
        # never on the outer ring: the eye lands on corners and edges first
        at = (rng.randrange(1, cols - 1), rng.randrange(1, rows - 1))
        level = Level(common, odd, cols, rows, seconds, at, kind)
        if kind == "colors":
            h = (hue + 0.17 * i) % 1.0
            level.colour = _hsv(h, 0.55, 0.62)
            level.odd_colour = _hsv(h, 0.55 - SHADE_STEPS[i] * 0.5, 0.62 + SHADE_STEPS[i])
        out.append(level)
    return out


def _hsv(h: float, s: float, v: float) -> tuple[int, int, int]:
    import colorsys
    return tuple(int(round(c * 255)) for c in colorsys.hsv_to_rgb(h, s, min(v, 1.0)))


def arabic_number(n: int) -> str:
    return "".join(DIGITS[int(d)] for d in str(n))


def _font(size: int, name: str = "NotoSansArabic-Black.ttf") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def _text(draw: ImageDraw.ImageDraw, xy, text: str, size: int, fill, anchor: str = "mm",
          name: str = "NotoSansArabic-Black.ttf") -> None:
    draw.text(xy, text, font=_font(size, name), fill=fill, anchor=anchor, direction="rtl", language="ar")


def _gradient(top, bottom) -> Image.Image:
    ramp = np.linspace(0, 1, H)[:, None, None]
    rows = (np.array(top) + (np.array(bottom) - np.array(top)) * ramp).astype(np.uint8)
    return Image.fromarray(np.repeat(rows, W, axis=1), "RGB")


_CACHE: dict[str, Image.Image] = {}


def _background(dark: bool = False) -> Image.Image:
    """Warm gradient, a soft glow at the top and a faint dot grid, drawn once and reused."""
    key = "dark" if dark else "cream"
    if key not in _CACHE:
        img = _gradient(DARK_TOP, DARK_BOTTOM) if dark else _gradient(CREAM_TOP, CREAM_BOTTOM)
        glow = Image.new("L", (W, H), 0)
        ImageDraw.Draw(glow).ellipse((W * 0.1, -H * 0.18, W * 0.9, H * 0.32), fill=120 if dark else 150)
        glow = glow.filter(ImageFilter.GaussianBlur(160))
        tint = Image.new("RGB", (W, H), (150, 82, 30) if dark else (255, 214, 150))
        img = Image.composite(tint, img, glow)
        d = ImageDraw.Draw(img)
        dot = (60, 46, 38) if dark else (236, 214, 186)
        for y in range(40, H, 64):
            for x in range(40, W, 64):
                d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=dot)
        _CACHE[key] = img
    return _CACHE[key].copy()


def _segments(d: ImageDraw.ImageDraw, total: int, current: int, y: int = 210) -> None:
    """Thin progress segments along the top, right to left: done and current lit."""
    x0, x1, gap = 210, W - 210, 14
    seg = (x1 - x0 - gap * (total - 1)) / total
    for i in range(total):
        x = x1 - (i + 1) * seg - i * gap
        colour = ORANGE if i == current else (250, 196, 120) if i < current else TRACK
        d.rounded_rectangle((x, y, x + seg, y + 12), 6, fill=colour)


def _pill(d: ImageDraw.ImageDraw, cx: int, cy: int, text: str, size: int, fill, ink, pad: int = 44) -> tuple:
    w = _font(size).getlength(text) + pad * 2
    h = size * 1.75
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    d.rounded_rectangle(box, h / 2, fill=fill)
    _text(d, (cx, cy - size * 0.08), text, size, ink)
    return box


def _grid_box(level: Level) -> tuple[int, int, int, int, float]:
    """The white card and its cell size, kept clear of the Shorts buttons and caption."""
    max_w, max_h, pad = 800, 860, 34
    cell = min(max_w / level.cols, max_h / level.rows)
    w, h = cell * level.cols, cell * level.rows
    x, y = (W - w) / 2, 460 + pad
    return int(x - pad), int(y - pad), int(x + w + pad), int(y + h + pad), cell


def _card(img: Image.Image, box) -> None:
    """White rounded card with a soft shadow under it."""
    shadow = Image.new("L", (W, H), 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 18, x1, y1 + 18), 40, fill=70)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    img.paste(Image.new("RGB", (W, H), (170, 120, 70)), (0, 0), shadow)
    ImageDraw.Draw(img).rounded_rectangle(box, 40, fill=CARD)


def _level_base(level: Level, number: int, total: int, reveal: bool, shown: float = 1.0) -> Image.Image:
    """One level screen. `shown` (0..1) is how much of the grid has drawn itself in."""
    img = _background()
    d = ImageDraw.Draw(img)
    _segments(d, total, number)
    label = LABELS[min(number, len(LABELS) - 1)]
    _pill(d, W // 2, 318, f"المستوى {arabic_number(number + 1)} - {label}", 46, PILL, INK)
    heading = {"colors": "دوّر على المربع المختلف!", "numbers": "دوّر على الرقم المختلف!"}.get(
        level.kind, "دوّر على الحرف المختلف!")
    _text(d, (W // 2, 405), heading, 62, INK)
    x0, y0, x1, y1, cell = _grid_box(level)
    _card(img, (x0, y0, x1, y1))
    d = ImageDraw.Draw(img)
    size = int(cell * 0.62)
    widest = max(_font(size).getlength(ch) for ch in (level.common, level.odd))
    if widest > cell * 0.72:
        size = int(size * cell * 0.72 / widest)
    count = level.rows * level.cols
    for row in range(level.rows):
        for col in range(level.cols):
            if row * level.cols + col >= shown * count:
                continue
            odd = (col, row) == level.at
            cx = x0 + 34 + cell * (level.cols - 1 - col) + cell / 2
            cy = y0 + 34 + cell * row + cell / 2
            if level.kind == "colors":
                half = cell * 0.42
                tile = level.odd_colour if odd else level.colour
                if reveal and not odd:
                    tile = tuple((a + 255 * 2) // 3 for a in tile)
                d.rounded_rectangle((cx - half, cy - half, cx + half, cy + half), 12, fill=tile)
                if reveal and odd:
                    d.rounded_rectangle((cx - half - 9, cy - half - 9, cx + half + 9, cy + half + 9),
                                        18, outline=GREEN, width=8)
                continue
            if reveal and odd:
                r = cell * 0.56
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(226, 247, 239), outline=GREEN,
                          width=max(4, int(cell * 0.07)))
            fill = GREEN if (reveal and odd) else FADED if reveal else INK
            wob = JITTER[min(number, len(JITTER) - 1)]
            g = random.Random(number * 10007 + row * 131 + col)
            gx, gy = g.uniform(-wob, wob) * cell, g.uniform(-wob, wob) * cell
            gs = int(size * (1 + g.uniform(-wob, wob) * 0.8))
            if reveal and odd:
                gx = gy = 0
                gs = int(size * 1.12)
            _text(d, (cx + gx, cy - size * 0.08 + gy), level.odd if odd else level.common, gs, fill)
    if reveal:
        note = {"colors": "هني!  لونه أفتح شوي", "numbers": f"هني!  «{level.odd}» بين «{level.common}»"}.get(
            level.kind, f"هني!  «{level.odd}» بين «{level.common}»")
        box = _pill(d, W // 2 - 30, y1 + 90, note, 52, GREEN, (255, 255, 255), pad=60)
        # the check badge at the start of the pill (right side, Arabic reads right to left)
        r, cx, cy = 34, box[2] + 10, (box[1] + box[3]) / 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN, outline=(255, 255, 255), width=5)
        d.line((cx - 15, cy, cx - 4, cy + 12, cx + 16, cy - 12), fill=(255, 255, 255), width=8, joint="curve")
    return img


def _timer(img: Image.Image, left: float, total: int) -> Image.Image:
    """Countdown circle tucked into the left edge: white disc, orange ring, red at the end."""
    frame = img.copy()
    d = ImageDraw.Draw(frame)
    cx, cy, r = 58, 405, 78
    colour = RED if left <= 2 else ORANGE
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255))
    d.arc((cx - r + 6, cy - r + 6, cx + r - 6, cy + r - 6), -90, -90 + 360 * left / total, fill=colour, width=12)
    _text(d, (cx + 14, cy - 8), arabic_number(max(1, math.ceil(left))), 70, INK)
    return frame


def _eye(d: ImageDraw.ImageDraw, cx: int, cy: int, w: int) -> None:
    h = w * 0.55
    d.ellipse((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), outline=ORANGE, width=14)
    d.ellipse((cx - h * 0.36, cy - h * 0.36, cx + h * 0.36, cy + h * 0.36), fill=ORANGE)
    d.ellipse((cx - h * 0.13, cy - h * 0.13, cx + h * 0.13, cy + h * 0.13), fill=DARK_BOTTOM)


def _hook(game: list[Level], t: float) -> Image.Image:
    """Dark opening: title with an eye, a taste of the grid, then the levels rise as bars."""
    img = _background(dark=True)
    d = ImageDraw.Draw(img)
    _pill(d, W // 2, 150, BRAND, 36, (52, 40, 34), (236, 222, 206))
    title = "تحدّي النظر!"
    tw = _font(130, "Lalezar-Regular.ttf").getlength(title)
    _text(d, (W // 2 - 70, 330), title, 130, ORANGE, name="Lalezar-Regular.ttf")
    _eye(d, int(W // 2 - 70 + tw / 2 + 110), 318, 150)
    first, cell, cols, rows = game[0], 132, 6, 4
    x0, y0 = (W - cell * cols) // 2, 470
    for row in range(rows):
        for col in range(cols):
            cx, cy = x0 + cell * col + cell // 2, y0 + cell * row + cell // 2
            odd = (col, row) == (2, 2)
            lit = odd and t > 0.9
            d.rounded_rectangle((cx - 58, cy - 58, cx + 58, cy + 58), 22, fill=(20, 110, 86) if lit else TILE)
            if first.kind == "colors":
                d.rounded_rectangle((cx - 40, cy - 40, cx + 40, cy + 40), 12,
                                    fill=first.odd_colour if odd else first.colour)
                continue
            _text(d, (cx, cy - 8), first.odd if odd else first.common, 80,
                  (120, 240, 200) if lit else (246, 236, 224))
    total = len(game)
    hard = "أصعب نسخة..." if total >= 5 else "تحدي جديد..."
    _text(d, (W // 2, 1060), f"{hard} {arabic_number(total)} مستويات!", 64, ORANGE)
    # bars grow one after another, level 1 on the right and shortest
    base, bw, gap = 1420, 104, 18
    xs = (W - (total * bw + (total - 1) * gap)) / 2
    for i in range(total):
        grow = min(1.0, max(0.0, (t - 0.25 - i * 0.16) / 0.3))
        if grow <= 0:
            continue
        h = (70 + 230 * i / max(1, total - 1)) * grow
        x = xs + (total - 1 - i) * (bw + gap)
        mix = i / max(1, total - 1)
        colour = tuple(int(a + (b - a) * mix) for a, b in zip(PILL, RED))
        d.rounded_rectangle((x, base - h, x + bw, base), 18, fill=colour)
        if grow > 0.6:
            _text(d, (x + bw / 2, base - h + 42), arabic_number(i + 1), 48, (255, 255, 255))
    return img


def _end(total: int) -> Image.Image:
    img = _background()
    d = ImageDraw.Draw(img)
    _segments(d, total, total)
    _text(d, (W // 2, 640), "وصلت أي مستوى؟", 120, ORANGE, name="Lalezar-Regular.ttf")
    _text(d, (W // 2, 810), "اكتب رقمك بالتعليقات 👇".replace(" 👇", ""), 66, INK)
    _pill(d, W // 2, 990, "تابعنا للتحدي الجاي", 58, GREEN, (255, 255, 255), pad=70)
    return img


def _tone(freq: float, seconds: float, volume: float, rate: int = 44100) -> np.ndarray:
    t = np.arange(int(rate * seconds)) / rate
    return volume * np.sin(2 * math.pi * freq * t) * np.exp(-t * 18)


# the same question in fuller Arabic, for the standard (non-Saudi) voice
INTRO_FUSHA = "هَلْ تَعْرِفُ أَيْنَ الحَرْفُ الغَرِيبُ؟ خَمْسُ مَرَاحِلَ، وَكُلُّ مَرْحَلَةٍ أَصْعَبُ. هَلْ أَنْتَ جَاهِزٌ؟ هَيَّا نَبْدَأْ!"
INTRO_BY_KIND = {
    "letters": INTRO_FUSHA,
    "numbers": "هَلْ تَعْرِفُ أَيْنَ الرَّقْمُ الغَرِيبُ؟ خَمْسُ مَرَاحِلَ، وَكُلُّ مَرْحَلَةٍ أَصْعَبُ. هَلْ أَنْتَ جَاهِزٌ؟ هَيَّا نَبْدَأْ!",
    "colors": "أَيُّ مُرَبَّعٍ لَوْنُهُ مُخْتَلِفٌ؟ خَمْسُ مَرَاحِلَ، وَكُلُّ مَرْحَلَةٍ أَصْعَبُ. هَلْ أَنْتَ جَاهِزٌ؟ هَيَّا نَبْدَأْ!",
}
INTRO_TEXT = "تدري وين الحرف الغريب؟ خمس مستويات.. وكل واحد أصعب. جاهز؟ يلا!"


def _voice_pcm(path: Path, rate: int = 44100) -> np.ndarray:
    """Decodes the spoken intro to mono floats at the quiz sample rate."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1",
                          "-ar", str(rate), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


def hook_length(voice: np.ndarray | None, rate: int = 44100) -> float:
    """The opening screen lasts as long as the question is spoken, plus a short beat."""
    return HOOK_S if voice is None else max(HOOK_S, len(voice) / rate + 0.5)


def soundtrack(game: list[Level], out: Path, rate: int = 44100,
               voice: np.ndarray | None = None) -> float:
    """Ticks for the countdown and a two-note chime on each answer. Returns the length."""
    hook = hook_length(voice, rate)
    total = hook + sum(level.seconds + REVEAL_S for level in game) + END_S
    audio = np.zeros(int(rate * total) + rate)

    def put(at: float, sound: np.ndarray) -> None:
        i = int(at * rate)
        audio[i:i + len(sound)] += sound

    if voice is None:
        put(0.0, _tone(180, 0.5, 0.5))
    else:
        put(0.1, voice * 0.95)
    at = hook
    for level in game:
        put(at, _tone(520, 0.25, 0.35))                        # a new level opens
        for second in range(level.seconds):
            last = level.seconds - second <= 2
            put(at + second, _tone(1500 if last else 1000, 0.09, 0.45 if last else 0.3))
        at += level.seconds
        put(at, _tone(880, 0.35, 0.5))
        put(at + 0.14, _tone(1320, 0.5, 0.5))
        at += REVEAL_S
    put(at, _tone(660, 0.6, 0.45))
    samples = (np.clip(audio[:int(rate * total)], -1, 1) * 32767).astype(np.int16)
    with wave.open(str(out), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(samples.tobytes())
    return total


def render(out: Path, seed: int, intro: Path | None = None, kind: str = "letters") -> list[Level]:
    """Writes the finished 9:16 video and returns the levels it used.
    `intro` is the spoken opening question: the test starts after it ends."""
    if not features.check("raqm"):
        raise RuntimeError("Pillow has no raqm text layout: Arabic words would come out unjoined")
    game = levels(seed, kind)
    out.parent.mkdir(parents=True, exist_ok=True)
    sound = out.with_suffix(".wav")
    voice = _voice_pcm(intro) if intro else None
    hook = hook_length(voice)
    total = soundtrack(game, sound, voice=voice)
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-i", str(sound), "-c:v", "libx264", "-preset", "medium",
         "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest",
         "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
    frames = int(total * FPS)
    done = 0

    def write(img: Image.Image) -> None:
        nonlocal done
        # the channel's red progress line along the bottom edge
        ImageDraw.Draw(img).rectangle((0, H - 10, W * (done + 1) / frames, H), fill=(255, 59, 48))
        ff.stdin.write(img.tobytes())
        done += 1

    for i in range(int(hook * FPS)):
        write(_hook(game, i / FPS))
    for number, level in enumerate(game):
        base = _level_base(level, number, len(game), reveal=False)
        fill_frames = int(FILL_S * FPS)
        for i in range(level.seconds * FPS):
            left = level.seconds - i / FPS
            frame = base if i >= fill_frames else _level_base(level, number, len(game), False, (i + 1) / fill_frames)
            write(_timer(frame, left, level.seconds))
        answer = _level_base(level, number, len(game), reveal=True)
        for _ in range(int(REVEAL_S * FPS)):
            write(answer.copy())
    end = _end(len(game))
    while done < frames:
        write(end.copy())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg could not write the quiz video")
    sound.unlink()
    return game


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("out", type=Path)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--kind", choices=list(KINDS), default="letters")
    p.add_argument("--intro", type=Path, help="audio file with the spoken opening question")
    a = p.parse_args()
    for number, level in enumerate(render(a.out, a.seed, a.intro, a.kind), 1):
        print(f"[quiz] level {number}: «{level.odd}» among «{level.common}» "
              f"{level.cols}x{level.rows} at column {level.at[0] + 1}, row {level.at[1] + 1}")


if __name__ == "__main__":
    main()
