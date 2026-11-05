"""Channel profile picture and banner built from the owner's character (assets/mascot/base.png)."""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts.config import Config  # noqa: E402

NAVY, TEAL, GOLD = (14, 22, 38), (31, 92, 96), (255, 196, 40)


def radial(size, inner, outer):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - w / 2, yy - h / 2) / (0.6 * max(w, h))
    d = np.clip(d, 0, 1)[..., None]
    arr = (np.array(inner) * (1 - d) + np.array(outer) * d).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def stars(img, n, seed=4):
    rng = np.random.default_rng(seed)
    d = ImageDraw.Draw(img)
    w, h = img.size
    for _ in range(n):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(1, 3.2)
        a = int(rng.uniform(90, 230))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))


def character(height):
    c = Image.open(ROOT / "assets/mascot/base.png").convert("RGBA")
    c = c.resize((int(c.width * height / c.height), height), Image.LANCZOS)
    glow = Image.new("RGBA", c.size, (0, 0, 0, 0))
    glow.putalpha(c.getchannel("A").filter(ImageFilter.GaussianBlur(18)))
    tint = Image.new("RGBA", c.size, GOLD + (0,))
    tint.putalpha(glow.getchannel("A").point(lambda v: int(v * 0.55)))
    out = Image.new("RGBA", (c.width + 80, c.height + 80), (0, 0, 0, 0))
    out.alpha_composite(tint.resize(out.size), (0, 0))
    out.alpha_composite(c, (40, 40))
    return out


def profile(path: Path):
    size = 1024
    img = radial((size, size), TEAL, NAVY)
    stars(img, 120)
    ch = character(1500)                       # head and chest fill the circle
    img.alpha_composite(ch, ((size - ch.width) // 2, 70))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
    ring = ImageDraw.Draw(img)
    ring.ellipse([10, 10, size - 10, size - 10], outline=GOLD + (255,), width=18)
    img.putalpha(mask)
    flat = Image.new("RGB", (size, size), NAVY)
    flat.paste(img, mask=img.getchannel("A"))
    flat.save(path, quality=95)


def banner(path: Path, cfg: Config):
    w, h = 2560, 1440
    img = radial((w, h), TEAL, NAVY)
    stars(img, 420)
    ch = character(340)
    # YouTube's safe area (what phones show) is the centre 1546x423: everything sits inside it
    img.alpha_composite(ch, (w // 2 + 200, h // 2 - ch.height // 2))
    base = path.with_suffix(".base.png")
    img.convert("RGB").save(base)
    ass = path.with_suffix(".ass")
    ass.write_text(f"""[Script Info]
PlayResX: {w}
PlayResY: {h}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Name,{cfg.font_name},180,&H0028C4FF,&H0028C4FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,10,6,5,0,0,0,1
Style: Tag,{cfg.font_name},66,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,4,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Name,,0,0,0,,{{\\pos({w // 2 - 180},{h // 2 - 45})}}دهشة
Dialogue: 0,0:00:00.00,0:00:05.00,Tag,,0,0,0,,{{\\pos({w // 2 - 180},{h // 2 + 95})}}قصص غامضة ومعلومات تبهرك.. كل يوم
""", encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", base.name, "-vf",
                    f"subtitles={ass.name}:fontsdir={cfg.font_dir.resolve()}", "-q:v", "2", path.name],
                   cwd=path.parent, check=True)
    base.unlink()
    ass.unlink()


def main():
    out = ROOT / "assets" / "channel"
    out.mkdir(parents=True, exist_ok=True)
    profile(out / "profile.jpg")
    banner(out / "banner.jpg", Config())
    print("branding ready")


if __name__ == "__main__":
    main()
