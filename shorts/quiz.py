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
from PIL import Image, ImageDraw, ImageFont, features

W, H, FPS = 1080, 1920, 30
FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"

# look-alike pairs (the common letter, the odd one), easiest first
EASY = [("٨", "٧"), ("س", "ش"), ("ب", "ت"), ("ص", "ض")]
MEDIUM = [("ح", "خ"), ("ر", "ز"), ("د", "ذ"), ("ع", "غ"), ("ط", "ظ")]
HARD = [("ي", "ى"), ("ه", "ة"), ("ف", "ق"), ("ا", "أ"), ("ن", "ت")]
# (columns, rows, seconds to look) per level
SHAPES = [(5, 6, 5), (6, 8, 5), (7, 9, 5), (8, 11, 5), (10, 13, 6)]

BG_TOP, BG_BOTTOM = (16, 30, 54), (8, 14, 28)
CARD, INK = (255, 248, 236), (18, 28, 48)
AMBER, GREEN, RED, MUTED = (255, 183, 3), (45, 201, 122), (255, 77, 77), (150, 165, 190)
DIGITS = "٠١٢٣٤٥٦٧٨٩"
HOOK_S, REVEAL_S, END_S = 2.6, 1.7, 3.2


@dataclass
class Level:
    common: str
    odd: str
    cols: int
    rows: int
    seconds: int
    at: tuple[int, int]          # (column, row) of the odd letter


def levels(seed: int) -> list[Level]:
    """Five levels, harder each time; the same seed always gives the same video."""
    rng = random.Random(seed)
    pairs = [rng.choice(EASY), *rng.sample(MEDIUM, 2), *rng.sample(HARD, 2)]
    out = []
    for (common, odd), (cols, rows, seconds) in zip(pairs, SHAPES):
        # never on the outer ring: the eye lands on corners and edges first
        at = (rng.randrange(1, cols - 1), rng.randrange(1, rows - 1))
        out.append(Level(common, odd, cols, rows, seconds, at))
    return out


def arabic_number(n: int) -> str:
    return "".join(DIGITS[int(d)] for d in str(n))


def _font(size: int, name: str = "NotoSansArabic-Black.ttf") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def _text(draw: ImageDraw.ImageDraw, xy, text: str, size: int, fill, anchor: str = "mm",
          name: str = "NotoSansArabic-Black.ttf") -> None:
    draw.text(xy, text, font=_font(size, name), fill=fill, anchor=anchor, direction="rtl", language="ar")


def _background() -> Image.Image:
    ramp = np.linspace(0, 1, H)[:, None, None]
    top, bottom = np.array(BG_TOP), np.array(BG_BOTTOM)
    rows = (top + (bottom - top) * ramp).astype(np.uint8)
    return Image.fromarray(np.repeat(rows, W, axis=1), "RGB")


def _ladder(draw: ImageDraw.ImageDraw, y: int, total: int, current: int, shown: int | None = None) -> None:
    """The row of level chips: done ones green, the current one amber, the rest dim."""
    size, gap = 104, 26
    x0 = (W - (total * size + (total - 1) * gap)) // 2
    for i in range(total if shown is None else shown):
        # right to left, as Arabic reads
        x = x0 + (total - 1 - i) * (size + gap)
        colour = GREEN if i < current else AMBER if i == current else (40, 58, 92)
        draw.rounded_rectangle((x, y, x + size, y + size), 26, fill=colour)
        _text(draw, (x + size // 2, y + size // 2 - 6), arabic_number(i + 1), 60,
              INK if i <= current else MUTED)


def _grid_box(level: Level) -> tuple[int, int, int, int, float]:
    """Card rectangle and cell size: inside the area the Shorts buttons do not cover."""
    max_w, max_h = 900, 1010
    cell = min(max_w / level.cols, max_h / level.rows)
    w, h = cell * level.cols, cell * level.rows
    x, y = (W - w) / 2, 560 + (max_h - h) / 2
    return int(x - 30), int(y - 30), int(x + w + 30), int(y + h + 30), cell


def _level_base(level: Level, number: int, total: int, reveal: bool) -> Image.Image:
    img = _background()
    d = ImageDraw.Draw(img)
    _ladder(d, 150, total, number)
    _text(d, (W // 2, 345), f"المستوى {arabic_number(number + 1)}", 76, AMBER)
    _text(d, (W // 2, 455), "وين الحرف الغريب؟", 66, (255, 255, 255))
    x0, y0, x1, y1, cell = _grid_box(level)
    d.rounded_rectangle((x0, y0, x1, y1), 44, fill=CARD)
    size = int(cell * 0.66)
    # wide letters (س، ص) must not touch their neighbours
    widest = max(_font(size).getlength(ch) for ch in (level.common, level.odd))
    if widest > cell * 0.72:
        size = int(size * cell * 0.72 / widest)
    for row in range(level.rows):
        for col in range(level.cols):
            odd = (col, row) == level.at
            cx = x0 + 30 + cell * (level.cols - 1 - col) + cell / 2
            cy = y0 + 30 + cell * row + cell / 2
            if reveal and odd:
                r = cell * 0.52
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN)
            fill = INK if (odd or not reveal) else (205, 198, 186)
            _text(d, (cx, cy - size * 0.08), level.odd if odd else level.common, size, fill)
    if reveal:
        d.rounded_rectangle((W // 2 - 330, y1 + 28, W // 2 + 330, y1 + 138), 55, fill=GREEN)
        _text(d, (W // 2, y1 + 76), f"هنا!  «{level.odd}» بين «{level.common}»", 58, INK)
    return img


def _timer(img: Image.Image, left: float, total: int) -> Image.Image:
    """Countdown ring in the top corner: turns red for the last two seconds."""
    frame = img.copy()
    d = ImageDraw.Draw(frame)
    cx, cy, r = 150, 400, 78
    colour = RED if left <= 2 else AMBER
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(28, 44, 74))
    d.arc((cx - r, cy - r, cx + r, cy + r), -90, -90 + 360 * left / total, fill=colour, width=14)
    _text(d, (cx, cy - 8), arabic_number(max(1, math.ceil(left))), 84, colour)
    return frame


def _hook(game: list[Level], t: float) -> Image.Image:
    img = _background()
    d = ImageDraw.Draw(img)
    _text(d, (W // 2, 330), "تحدّي العين", 150, AMBER, name="Lalezar-Regular.ttf")
    _text(d, (W // 2, 520), f"{arabic_number(len(game))} مستويات.. كل واحد أصعب", 64, (255, 255, 255))
    # a taste of the game: a small grid with its odd letter already lit
    first, cell = game[0], 118
    x0, y0 = (W - cell * 5) // 2, 660
    d.rounded_rectangle((x0 - 30, y0 - 30, x0 + cell * 5 + 30, y0 + cell * 3 + 30), 40, fill=CARD)
    for row in range(3):
        for col in range(5):
            cx, cy = x0 + cell * col + cell // 2, y0 + cell * row + cell // 2
            odd = (col, row) == (1, 1)
            if odd:
                d.ellipse((cx - 56, cy - 56, cx + 56, cy + 56), fill=GREEN)
            _text(d, (cx, cy - 6), first.odd if odd else first.common, 78, INK)
    # the chips pop in one by one, then the question lands
    _ladder(d, 1130, len(game), -1, shown=min(len(game), int(t / 0.22) + 1))
    if t > 1.3:
        d.rounded_rectangle((W // 2 - 330, 1320, W // 2 + 330, 1450), 65, fill=AMBER)
        _text(d, (W // 2, 1376), "توصل للأخير؟", 76, INK)
    return img


def _end(total: int) -> Image.Image:
    img = _background()
    d = ImageDraw.Draw(img)
    _ladder(d, 420, total, total)
    _text(d, (W // 2, 720), "وصلت أي مستوى؟", 118, AMBER, name="Lalezar-Regular.ttf")
    _text(d, (W // 2, 900), "اكتب رقمك بالتعليقات", 70, (255, 255, 255))
    d.rounded_rectangle((W // 2 - 380, 1050, W // 2 + 380, 1180), 65, fill=GREEN)
    _text(d, (W // 2, 1106), "تابعنا للتحدي الجاي", 66, INK)
    return img


def _tone(freq: float, seconds: float, volume: float, rate: int = 44100) -> np.ndarray:
    t = np.arange(int(rate * seconds)) / rate
    return volume * np.sin(2 * math.pi * freq * t) * np.exp(-t * 18)


def soundtrack(game: list[Level], out: Path, rate: int = 44100) -> float:
    """Ticks for the countdown and a two-note chime on each answer. Returns the length."""
    total = HOOK_S + sum(level.seconds + REVEAL_S for level in game) + END_S
    audio = np.zeros(int(rate * total) + rate)

    def put(at: float, sound: np.ndarray) -> None:
        i = int(at * rate)
        audio[i:i + len(sound)] += sound

    put(0.0, _tone(180, 0.5, 0.5))
    at = HOOK_S
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


def render(out: Path, seed: int) -> list[Level]:
    """Writes the finished 9:16 video and returns the levels it used."""
    if not features.check("raqm"):
        raise RuntimeError("Pillow has no raqm text layout: Arabic words would come out unjoined")
    game = levels(seed)
    out.parent.mkdir(parents=True, exist_ok=True)
    sound = out.with_suffix(".wav")
    total = soundtrack(game, sound)
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

    for i in range(int(HOOK_S * FPS)):
        write(_hook(game, i / FPS))
    for number, level in enumerate(game):
        base = _level_base(level, number, len(game), reveal=False)
        for i in range(level.seconds * FPS):
            write(_timer(base, level.seconds - i / FPS, level.seconds))
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
    a = p.parse_args()
    for number, level in enumerate(render(a.out, a.seed), 1):
        print(f"[quiz] level {number}: «{level.odd}» among «{level.common}» "
              f"{level.cols}x{level.rows} at column {level.at[0] + 1}, row {level.at[1] + 1}")


if __name__ == "__main__":
    main()
