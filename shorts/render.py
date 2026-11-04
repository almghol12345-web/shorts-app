"""Final assembly: background + captions + narration + music composed for the story's mood."""
import random
import subprocess
from pathlib import Path

from .captions import build_ass
from .config import Config
from .voice import Narration


NARRATOR_SCALE = 0.95  # the storyteller stands bottom-left, leaving the scene art visible


def render(cfg: Config, narration: Narration, background: Path, workdir: Path, out: Path,
           narrator: Path | None = None, mood: str = "mystery", cuts: list[float] | None = None,
           booms: list[float] | None = None, cards: list[tuple] | None = None) -> Path:
    total = narration.length
    ass = workdir / "captions.ass"
    from .captions import CAPTION_Y, CAPTION_Y_NARRATOR
    ass.write_text(build_ass(narration.words, narration.line_sizes, total,
                             cfg.width, cfg.height, cfg.font_name,
                             caption_y=CAPTION_Y_NARRATOR if narrator else CAPTION_Y,
                             cards=cards or []), encoding="utf-8")

    music = sorted(cfg.music_dir.glob("*.mp3")) if cfg.music_dir.exists() else []
    cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(background.resolve()),
           "-i", str(narration.audio.resolve())]
    # inputs: 0 background, 1 voice, 2..3 music bed, last: the narrator overlay (optional)
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(random.choice(music).resolve())]
        bed = "[2:a]volume=0.12"
    else:
        # music composed for this story's mood (owned by the channel, no licence needed)
        from .music import write_bed
        track = write_bed(mood, total + 0.5, workdir / f"music_{mood}.wav")
        cmd += ["-i", str(track.resolve())]
        bed = "[2:a]aresample=44100,volume=1.0"
    fade = max(total - 1.5, 0)
    # sound design: soft whooshes on the cuts, low booms on the big moments (index 3 input)
    from .music import write_sfx
    # no whoosh on the cuts (the owner finds it cheap); only a soft low boom on the big moments
    sfx = write_sfx(total, [], [0.0] + (booms or []), workdir / "sfx.wav", boom_gain=0.25)
    sfx_idx = 3
    cmd += ["-i", str(sfx.resolve())]
    af = (f"[1:a]asplit=2[v1][v2];"
          f"{bed},afade=t=in:d=0.3,afade=t=out:st={fade:.2f}:d=1.5[bed];"
          # the bed ducks under the voice so every word stays clear
          f"[bed][v2]sidechaincompress=threshold=0.04:ratio=5:attack=20:release=500[duck];"
          f"[{sfx_idx}:a]aresample=44100[fx];"
          f"[v1][duck][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95[a]")
    # Dark, grainy look: stronger vignette and film grain on top of the graded footage.
    subs = f"subtitles=captions.ass:fontsdir={cfg.font_dir.resolve()}"
    if narrator:
        idx = 4
        cmd += ["-i", str(narrator.resolve())]
        # the storyteller stands at the bottom, a little left of centre (clear of YouTube's buttons)
        vf = (f"[0:v]vignette=PI/3.2,noise=alls=3:allf=t[bgv];"
              f"[{idx}:v]scale=iw*{NARRATOR_SCALE}:-1:flags=lanczos[nar];"
              f"[bgv][nar]overlay=x=40:y=H-h+50:format=auto,{subs}[v]")
    else:
        vf = f"[0:v]vignette=PI/3.2,noise=alls=3:allf=t,{subs}[v]"
    cmd += ["-filter_complex", f"{vf};{af}", "-map", "[v]", "-map", "[a]",
            "-t", f"{total:.2f}", "-r", "30",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", "12M", "-bufsize", "24M",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out.resolve())]
    result = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"render failed:\n{result.stderr[-3000:]}")
    return out


def contact_sheet(video: Path, times: list[float], out: Path) -> Path:
    """One small frame per shot, tiled, so a run can be checked at a glance."""
    from .media import run
    frames = []
    for i, t in enumerate(times):
        f = out.with_name(f"{out.stem}_{i}.jpg")
        run(["ffmpeg", "-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
             "-vf", "scale=270:480", str(f)])
        frames.append(f)
    cols = min(len(frames), 4)
    rows = (len(frames) + cols - 1) // cols
    inputs = sum((["-i", str(f)] for f in frames), [])
    layout = "|".join(f"{(i % cols) * 270}_{(i // cols) * 480}" for i in range(len(frames)))
    run(["ffmpeg", "-y", *inputs, "-filter_complex",
         f"xstack=inputs={len(frames)}:layout={layout}:fill=black" if len(frames) > 1 else "null",
         "-frames:v", "1", "-q:v", "4", str(out)])
    for f in frames:
        f.unlink(missing_ok=True)
    return out
