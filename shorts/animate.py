"""Smooth, anime-like acting for the narrator, driven by the narration:
- mouth: follows the voice loudness through 8 openings, eased (fast to open, softer to close),
- eyes: natural blinks with in-between eyelid frames; pupils glance around and ease back,
- brows: lift on emphasis (loud moments),
- head: gentle continuous tilt plus small nods that follow the speech,
- right hand: eases up with a raised finger at the start of every other point, small
  "making a point" shakes while up, then eases down,
- walk: a soft step bounce and side sway.
Rendered as a transparent overlay video placed over the scene art."""
import math
import random
import subprocess
from pathlib import Path

import numpy as np

from .character import (ARM_STEPS, LID_STEPS, MOUTH_STEPS, compose, with_shadow)

FPS = 30
BOB = 8         # pixels of step bounce
SWAY = 6        # pixels of side sway
STEP_HZ = 1.6   # steps per second


def _ease(t: float) -> float:
    """Smooth in-out (0..1 -> 0..1)."""
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def loudness(audio: Path, frames: int) -> np.ndarray:
    """Voice loudness per video frame, normalised to about 0..1."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", "16000",
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    per = 16000 // FPS
    loud = np.zeros(frames, dtype=np.float32)
    for i in range(frames):
        chunk = pcm[i * per:(i + 1) * per]
        if chunk.size:
            loud[i] = math.sqrt(float(np.mean(chunk ** 2)))
    ref = np.percentile(loud[loud > 0], 92) if np.any(loud > 0) else 1.0
    return np.clip(loud / (ref or 1.0), 0, 1.2)


def mouth_curve(loud: np.ndarray) -> np.ndarray:
    """Eased mouth openness 0..1: opens quickly, closes a bit softer (no jitter)."""
    out = np.zeros_like(loud)
    o = 0.0
    for i, v in enumerate(loud):
        target = 0.0 if v < 0.12 else min(1.0, (v - 0.12) / 0.75)
        o += (target - o) * (0.65 if target > o else 0.45)
        out[i] = o
    return out


def mouth_levels(audio: Path, frames: int) -> list[int]:
    """Mouth step (0 closed .. MOUTH_STEPS-1 wide) for every frame."""
    curve = mouth_curve(loudness(audio, frames))
    return [int(round(o * (MOUTH_STEPS - 1))) for o in curve]


def blink_lids(frames: int, rnd: random.Random) -> list[int]:
    """Eyelid step per frame: blinks close and open over a few in-between frames."""
    lids = [0] * frames
    shape = [1, 2, 3, 3, 2, 1]                     # half, mostly, closed, closed, mostly, half
    t = rnd.uniform(1.2, 2.5)
    while t * FPS < frames:
        f = int(t * FPS)
        for k, v in enumerate(shape):
            if f + k < frames:
                lids[f + k] = min(v, LID_STEPS - 1)
        t += rnd.uniform(2.2, 4.8) if rnd.random() > 0.15 else 0.35   # sometimes a double blink
    return lids


def glances(frames: int, rnd: random.Random) -> list[tuple[int, int]]:
    """Pupils drift to a new spot every couple of seconds and ease there."""
    out, pos, target, next_change = [], [0.0, 0.0], [0.0, 0.0], 0
    for f in range(frames):
        if f >= next_change:
            target = rnd.choice([[0, 0], [0, 0], [-2, 0], [2, 0], [-1, -1], [1, -1], [0, 1], [-2, 1]])
            next_change = f + int(rnd.uniform(1.4, 3.2) * FPS)
        pos[0] += (target[0] - pos[0]) * 0.25
        pos[1] += (target[1] - pos[1]) * 0.25
        out.append((int(round(pos[0])), int(round(pos[1]))))
    return out


def arm_curve(line_starts: list[float], frames: int) -> list[float]:
    """Hand raise 0..1 per frame: ease up, hold with small shakes, ease down."""
    up, hold, down = 0.30, 1.10, 0.35
    arm = [0.0] * frames
    for n, start in enumerate(line_starts):
        if n % 2:
            continue
        for f in range(int(start * FPS), min(int((start + up + hold + down) * FPS) + 1, frames)):
            t = f / FPS - start
            if t < up:
                v = _ease(t / up)
            elif t < up + hold:
                v = 1.0 - 0.10 * (0.5 + 0.5 * math.sin((t - up) * 2 * math.pi * 2.2))  # "listen!"
            else:
                v = 1.0 - _ease((t - up - hold) / down)
            arm[f] = max(arm[f], v)
    return arm


def character_track(audio: Path, line_starts: list[float], seconds: float, out: Path,
                    seed: int = 7) -> tuple[Path, tuple[int, int]]:
    """Writes the transparent narrator overlay; returns it and its (width, height)."""
    frames = int(seconds * FPS) + 1
    rnd = random.Random(seed)
    loud = loudness(audio, frames)
    mouth = mouth_curve(loud)
    lids = blink_lids(frames, rnd)
    eyes = glances(frames, rnd)
    arm = arm_curve(line_starts, frames)

    brow, nod_v, brows, nods = 0.0, 0.0, [], []
    for f in range(frames):
        brow += ((2.0 if loud[f] > 0.85 else 1.0 if loud[f] > 0.5 else 0.0) - brow) * 0.15
        nod_v += (mouth[f] * 7.0 - nod_v) * 0.3                 # head dips slightly with speech
        brows.append(int(round(brow)))
        nods.append(nod_v)

    sample = with_shadow(compose())
    cw, ch = sample.width + 2 * SWAY + 4, sample.height + BOB + 24
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{cw}x{ch}",
         "-r", str(FPS), "-i", "-", "-c:v", "png", str(out)],
        stdin=subprocess.PIPE)
    try:
        from PIL import Image
        for f in range(frames):
            t = f / FPS
            tilt = 2.2 * math.sin(2 * math.pi * 0.23 * t) + 1.2 * math.sin(2 * math.pi * 0.61 * t) * mouth[f]
            fig = compose(arm_step=int(round(arm[f] * (ARM_STEPS - 1))),
                          mouth_step=int(round(mouth[f] * (MOUTH_STEPS - 1))),
                          lid_step=lids[f], pupil=eyes[f], brow_step=brows[f],
                          tilt=round(tilt * 4) / 4, nod=nods[f])
            fig = with_shadow(fig)
            phase = 2 * math.pi * STEP_HZ * t
            dy = BOB * abs(math.sin(phase))                   # up on every step
            dx = SWAY * math.sin(phase / 2)                   # weight shifts left/right
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            canvas.alpha_composite(fig, (int(SWAY + dx + 2), int(BOB - dy + 2)))
            proc.stdin.write(canvas.tobytes())
    finally:
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("character track encoding failed")
    return out, (cw, ch)
