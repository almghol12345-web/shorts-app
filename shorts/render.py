"""Final assembly: background + captions + narration (+ optional music)."""
import random
import subprocess
from pathlib import Path

from .captions import build_ass
from .config import Config
from .voice import Narration


def render(cfg: Config, narration: Narration, background: Path, workdir: Path, out: Path) -> Path:
    total = narration.length
    ass = workdir / "captions.ass"
    ass.write_text(build_ass(narration.words, narration.line_sizes, total,
                             cfg.width, cfg.height, cfg.font_name), encoding="utf-8")

    music = sorted(cfg.music_dir.glob("*.mp3")) if cfg.music_dir.exists() else []
    cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(background.resolve()),
           "-i", str(narration.audio.resolve())]
    vf = (f"[0:v]vignette=PI/4,"
          f"subtitles=captions.ass:fontsdir={cfg.font_dir.resolve()}[v]")
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(random.choice(music).resolve())]
        af = "[2:a]volume=0.10[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]"
    else:
        af = "[1:a]apad[a]"
    cmd += ["-filter_complex", f"{vf};{af}", "-map", "[v]", "-map", "[a]",
            "-t", f"{total:.2f}", "-r", "30",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out.resolve())]
    result = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"render failed:\n{result.stderr[-3000:]}")
    return out
