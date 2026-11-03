"""Paid scene art and motion from Replicate (used when REPLICATE_API_TOKEN is set).

- image(): one illustration per line with FLUX (cheap, about a third of a cent each).
- animate(): turns the most important shots (the hook and the twist) into real motion
  with an image-to-video model. Which shots move is set by REPLICATE_VIDEO_SHOTS
  (default "0,1,-3": the first two lines and the twist before the ending question);
  "none" turns motion off, "all" animates every line.
Models can be swapped with REPLICATE_IMAGE_MODEL / REPLICATE_VIDEO_MODEL.
"""
import os
import time
from pathlib import Path

import requests

API = "https://api.replicate.com/v1"
IMAGE_MODEL = "black-forest-labs/flux-schnell"
VIDEO_MODEL = "wan-video/wan-2.2-i2v-fast"


def token() -> str:
    return os.environ.get("REPLICATE_API_TOKEN", "").strip()


def _headers() -> dict:
    return {"Authorization": f"Bearer {token()}", "Content-Type": "application/json", "Prefer": "wait=60"}


def _run(model: str, inputs: dict, timeout: float) -> str:
    """Runs a model and returns the first output URL."""
    resp = requests.post(f"{API}/models/{model}/predictions", headers=_headers(),
                         json={"input": inputs}, timeout=90)
    if not resp.ok:
        raise RuntimeError(f"Replicate HTTP {resp.status_code}: {resp.text[:300]}")
    pred = resp.json()
    deadline = time.time() + timeout
    while pred.get("status") not in ("succeeded", "failed", "canceled"):
        if time.time() > deadline:
            raise TimeoutError(f"{model} took longer than {timeout:.0f}s")
        time.sleep(3)
        pred = requests.get(pred["urls"]["get"], headers=_headers(), timeout=30).json()
    if pred.get("status") != "succeeded":
        raise RuntimeError(f"{model} {pred.get('status')}: {str(pred.get('error'))[:300]}")
    out = pred.get("output")
    link = out[0] if isinstance(out, list) else out
    if not isinstance(link, str):
        raise RuntimeError(f"{model}: unexpected output {type(out).__name__}")
    return link


def _save(link: str, out: Path) -> None:
    got = requests.get(link, timeout=180)
    got.raise_for_status()
    out.write_bytes(got.content)


def image(prompt: str, out: Path) -> str:
    """Saves a 9:16 illustration to `out` and returns its URL (reused for motion)."""
    model = os.environ.get("REPLICATE_IMAGE_MODEL", "").strip() or IMAGE_MODEL
    inputs = {"prompt": prompt, "aspect_ratio": "9:16", "output_format": "jpg",
              "num_outputs": 1, "output_quality": 92}
    try:
        link = _run(model, inputs, timeout=120)
    except RuntimeError as exc:
        # the safety filter sometimes flags harmless scenes (a person in a wheelchair,
        # children at home); one retry with a calmer wording usually passes
        if "NSFW" not in str(exc):
            raise
        inputs["prompt"] = f"safe family friendly scene, fully clothed people, {prompt}"
        link = _run(model, inputs, timeout=120)
    _save(link, out)
    return link


def animate(image_url: str, prompt: str, out: Path) -> None:
    """Saves a short clip that brings the illustration to life."""
    model = os.environ.get("REPLICATE_VIDEO_MODEL", "").strip() or VIDEO_MODEL
    inputs = {"image": image_url, "prompt": f"{prompt}, subtle natural motion, cinematic camera move",
              "resolution": "480p"}
    try:
        link = _run(model, inputs, timeout=420)
    except (RuntimeError, TimeoutError):
        time.sleep(5)                       # brief hiccups ("model not found") pass on retry
        link = _run(model, inputs, timeout=420)
    _save(link, out)


def video_shots(count: int) -> set[int]:
    """Indexes of the lines that get motion (negative numbers count from the end)."""
    spec = os.environ.get("REPLICATE_VIDEO_SHOTS", "").strip().lower() or "0,1,-3"
    if spec == "none" or count == 0:
        return set()
    if spec == "all":
        return set(range(count))
    picked = set()
    for part in spec.split(","):
        try:
            i = int(part)
        except ValueError:
            continue
        i = i + count if i < 0 else i
        if 0 <= i < count:
            picked.add(i)
    return picked
