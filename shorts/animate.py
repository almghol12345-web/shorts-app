"""Brings the narrator to life over the narration:
- the mouth opens with the loudness of the voice (lip-flap sync),
- the eyes blink every few seconds,
- the right hand rises while he starts explaining a new point,
- a gentle step bob and sway, as if he is walking and talking.
The result is a transparent overlay video placed over the scene art."""
import random
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

from .character import pose

FPS = 30
BOB = 9        # pixels of step bounce
SWAY = 7       # pixels of side sway
STEP_HZ = 1.7  # steps per second


def mouth_levels(audio: Path, frames: int) -> list[int]:
    """0 closed / 1 half / 2 open for every video frame, from the voice loudness."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", "16000",
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    per = 16000 // FPS
    levels = []
    loud = []
    for i in range(frames):
        chunk = pcm[i * per:(i + 1) * per]
        loud.append(float(np.sqrt(np.mean(chunk ** 2))) if chunk.size else 0.0)
    ref = np.percentile([v for v in loud if v > 0] or [1.0], 90) or 1.0
    for v in loud:
        r = v / ref
        levels.append(2 if r > 0.55 else 1 if r > 0.18 else 0)
    # avoid one-frame flicker: a mouth state lasts at least two frames
    for i in range(1, len(levels) - 1):
        if levels[i - 1] == levels[i + 1] != levels[i]:
            levels[i] = levels[i - 1]
    return levels


def gesture_frames(line_starts: list[float], frames: int) -> set[int]:
    """Raise the hand for ~1.3 s at the start of every other line (not too busy)."""
    up = set()
    for n, start in enumerate(line_starts):
        if n % 2 == 0:
            first = int(start * FPS) + 3
            up.update(range(first, min(first + int(1.3 * FPS), frames)))
    return up


def blink_frames(frames: int, seed: int) -> set[int]:
    rnd = random.Random(seed)
    out, t = set(), rnd.uniform(1.5, 3.0)
    while t * FPS < frames:
        f = int(t * FPS)
        out.update(range(f, f + 4))
        t += rnd.uniform(2.5, 5.0)
    return out


def character_track(audio: Path, line_starts: list[float], seconds: float, out: Path,
                    scale: float = 1.0, seed: int = 7) -> tuple[Path, tuple[int, int]]:
    """Writes a transparent overlay video; returns it and its (width, height)."""
    frames = int(seconds * FPS) + 1
    mouth = mouth_levels(audio, frames)
    arm = gesture_frames(line_starts, frames)
    blink = blink_frames(frames, seed)

    base = pose()
    pw, ph = int(base.width * scale), int(base.height * scale)
    cw, ch = pw + 2 * SWAY + 4, ph + BOB + 4
    cache: dict = {}

    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{cw}x{ch}",
         "-r", str(FPS), "-i", "-", "-c:v", "png", str(out)],
        stdin=subprocess.PIPE)
    try:
        for f in range(frames):
            key = (mouth[f], f in blink, f in arm)
            if key not in cache:
                img = pose(*key)
                cache[key] = img.resize((pw, ph), Image.LANCZOS) if scale != 1.0 else img
            t = f / FPS
            phase = 2 * np.pi * STEP_HZ * t
            dy = int(BOB * abs(np.sin(phase)))           # up on every step
            dx = int(SWAY * np.sin(phase / 2))           # weight shifts left/right
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            canvas.alpha_composite(cache[key], (SWAY + dx + 2, BOB - dy + 2))
            proc.stdin.write(canvas.tobytes())
    finally:
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("character track encoding failed")
    return out, (cw, ch)
