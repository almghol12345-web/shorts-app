"""Banner: deep space, a black hole in the middle, the channel name drawn inside it."""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
W, H = 2560, 1440
NAME = "غيهب"
TAGLINE = "قصص غامضة ومعلومات تبهرك.. كل يوم"


def space() -> Image.Image:
    cx, cy = W / 2, H / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = xx - cx, yy - cy
    rng = np.random.default_rng(11)
    img = np.zeros((H, W, 3), np.float32)
    for _ in range(2600):
        x, y = int(rng.uniform(1, W - 2)), int(rng.uniform(1, H - 2))
        b = rng.uniform(0.15, 1) ** 2.5
        img[y, x] = 255 * b
        if b > 0.6:
            img[y - 1:y + 2, x - 1:x + 2] += 90 * b
    img = np.array(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) * 1.6
    r = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    streak = 0.75 + 0.25 * np.sin(ang * 23 + r * 0.05) * np.sin(ang * 7 - r * 0.02)

    def ramp(t):
        t = np.clip(t, 0, 1.4)
        return np.stack([np.clip(t * 2.2, 0, 1), np.clip(t * 1.6 - 0.25, 0, 1),
                         np.clip(t * 1.5 - 0.85, 0, 1)], -1) * 255

    rd = np.sqrt(dx ** 2 + (dy / 0.22) ** 2)
    disk = np.exp(-((rd - 360) / 120) ** 2) * (rd > 190) * streak
    ring = np.exp(-((r - 196) / 14) ** 2) * 1.25 + np.exp(-((r - 196) / 60) ** 2) * 0.35
    glow = np.exp(-(r / 520) ** 2) * 0.05
    img = img + ramp(disk + ring + glow)
    img[r < 185] = 0                                        # the hole: pure black
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))


def main() -> None:
    out = ROOT / "assets" / "channel" / "banner.jpg"
    base = out.with_name("banner_base.png")
    space().save(base)
    ass = out.with_name("banner.ass")
    ass.write_text(f"""[Script Info]
PlayResX: {W}
PlayResY: {H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Name,Lalezar,190,&H0028C4FF,&H0028C4FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,4,0,5,0,0,0,1
Style: Tag,Noto Sans Arabic Blk,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Name,,0,0,0,,{{\\pos({W // 2},{H // 2 + 8})\\blur1}}{NAME}
Dialogue: 0,0:00:00.00,0:00:05.00,Tag,,0,0,0,,{{\\pos({W // 2},{H // 2 + 168})}}{TAGLINE}
""", encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", base.name, "-vf",
                    f"subtitles={ass.name}:fontsdir={(ROOT / 'assets' / 'fonts').resolve()}", "-q:v", "2",
                    out.name], cwd=out.parent, check=True)
    base.unlink()
    ass.unlink()
    print("banner ready")


if __name__ == "__main__":
    main()
