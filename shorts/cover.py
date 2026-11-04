"""A clean cover for every Short: the opening scene with the full title, big and centred on
two lines (white over yellow), instead of whatever frame YouTube picks (usually a half
caption). Also used as the video's first frame, so a frame pick lands on it too."""
import re
from pathlib import Path

from .media import run
from .spoken import plain

W, H = 1080, 1920


def headline(title: str) -> tuple[str, str]:
    """Title without hashtags/emoji, split into two balanced lines."""
    text = plain(title)
    text = re.sub(r"#\S+", "", text)
    text = re.sub(r"[\U0001F300-\U0001FAFF☀-➿]", "", text)
    text = re.sub(r"\s+", " ", text).strip(" .!؟?…")
    words = text.split()
    if len(words) < 3:
        return text, ""
    best, cut = None, 1
    for k in range(1, len(words)):
        a, b = " ".join(words[:k]), " ".join(words[k:])
        score = abs(len(a) - len(b))
        if best is None or score < best:
            best, cut = score, k
    return " ".join(words[:cut]), " ".join(words[cut:])


def make(scene_video: Path, at: float, title: str, out: Path, font_name: str, font_dir: Path) -> Path:
    """Cover image from a frame of the (caption-free) background video."""
    top, bottom = headline(title)
    longest = max(len(top), len(bottom))
    size = 160 if longest <= 14 else 140 if longest <= 18 else 118 if longest <= 24 else 96
    ass = out.with_suffix(".ass")
    ass.write_text(f"""[Script Info]
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Top,{font_name},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,14,6,5,40,40,0,1
Style: Bottom,{font_name},{int(size * 1.1)},&H0000E1FF,&H0000E1FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,15,6,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Top,,0,0,0,,{{\\pos({W // 2},{int(H * 0.33)})}}{top}
Dialogue: 0,0:00:00.00,0:00:05.00,Bottom,,0,0,0,,{{\\pos({W // 2},{int(H * 0.33) + int(size * 1.45)})}}{bottom}
""", encoding="utf-8")
    run(["ffmpeg", "-y", "-ss", f"{at:.2f}", "-i", str(scene_video.resolve()), "-frames:v", "1", "-vf",
         f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},eq=contrast=1.1:saturation=1.15,"
         f"vignette=PI/4,subtitles={ass.name}:fontsdir={font_dir.resolve()}",
         "-q:v", "2", str(out.resolve())], cwd=out.parent)
    return out
