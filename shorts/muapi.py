"""Scene art and motion from Muapi (the paid gateway behind "Open Generative AI",
the open-source Higgsfield alternative). Used when MUAPI_API_KEY is set.

Same job as replicate.py: image() makes one illustration per line, animate() turns it
into a short clip. Models can be swapped with MUAPI_IMAGE_MODEL / MUAPI_VIDEO_MODEL
(any endpoint name from muapi.ai, e.g. "flux-dev-image", "kling-o1-standard-image-to-video").
Pattern: POST /api/v1/{model} -> request_id, then poll /api/v1/predictions/{id}/result.
"""
import os
import time
from pathlib import Path

import requests

API = "https://api.muapi.ai/api/v1"
IMAGE_MODEL = "flux-schnell-image"
VIDEO_MODEL = "wan2.1-image-to-video"
SIZES = {"9:16": (768, 1344), "16:9": (1344, 768), "1:1": (1024, 1024)}


def token() -> str:
    return os.environ.get("MUAPI_API_KEY", "").strip()


def _headers() -> dict:
    return {"x-api-key": token(), "Content-Type": "application/json"}


def _body(resp: requests.Response) -> dict:
    data = resp.json()
    # some endpoints wrap the answer in {"data": {...}}
    return data.get("data", data) if isinstance(data, dict) else {}


def _link(res: dict) -> str | None:
    """Finds the output URL whatever shape the model answers with."""
    for key in ("outputs", "output", "images", "videos"):
        val = res.get(key)
        if isinstance(val, list) and val:
            val = val[0]
        if isinstance(val, dict):
            val = val.get("url")
        if isinstance(val, str) and val.startswith("http"):
            return val
    for key in ("video", "image"):
        val = res.get(key)
        if isinstance(val, dict) and isinstance(val.get("url"), str):
            return val["url"]
    return None


def _run(model: str, inputs: dict, timeout: float) -> str:
    """Submits a job, waits for it, and returns the first output URL."""
    for attempt in range(6):
        resp = requests.post(f"{API}/{model}", headers=_headers(), json=inputs, timeout=90)
        if resp.status_code != 429 or attempt == 5:
            break
        wait = float(resp.headers.get("retry-after") or 0) or 10.0
        print(f"[muapi] busy (429); waiting {wait:.0f}s")
        time.sleep(min(wait + 1, 60))
    if not resp.ok:
        raise RuntimeError(f"Muapi HTTP {resp.status_code}: {resp.text[:300]}")
    job = _body(resp)
    request_id = job.get("request_id") or job.get("id")
    if not request_id:
        raise RuntimeError(f"{model}: no request_id in {str(job)[:300]}")
    deadline = time.time() + timeout
    while True:
        if time.time() > deadline:
            raise TimeoutError(f"{model} took longer than {timeout:.0f}s")
        time.sleep(3)
        got = requests.get(f"{API}/predictions/{request_id}/result", headers=_headers(), timeout=30)
        if not got.ok:
            continue
        res = _body(got)
        status = str(res.get("status", "")).lower()
        if status in ("failed", "error", "canceled", "cancelled"):
            raise RuntimeError(f"{model} {status}: {str(res.get('error'))[:300]}")
        if status in ("completed", "succeeded", "success"):
            link = _link(res)
            if not link:
                raise RuntimeError(f"{model}: finished without an output URL")
            return link


def _save(link: str, out: Path) -> None:
    got = requests.get(link, timeout=180)
    got.raise_for_status()
    out.write_bytes(got.content)


def image(prompt: str, out: Path, aspect: str = "9:16") -> str:
    model = os.environ.get("MUAPI_IMAGE_MODEL", "").strip() or IMAGE_MODEL
    width, height = SIZES.get(aspect, SIZES["9:16"])
    inputs = {"prompt": prompt, "aspect_ratio": aspect, "width": width, "height": height,
              "num_images": 1}
    link = _run(model, inputs, timeout=180)
    _save(link, out)
    return link


def animate(image_url: str, prompt: str, out: Path) -> None:
    model = os.environ.get("MUAPI_VIDEO_MODEL", "").strip() or VIDEO_MODEL
    inputs = {"image_url": image_url, "prompt": f"{prompt}, subtle natural motion, cinematic camera move",
              "resolution": "480p", "aspect_ratio": "9:16", "duration": 5}
    try:
        link = _run(model, inputs, timeout=480)
    except (RuntimeError, TimeoutError):
        time.sleep(5)
        link = _run(model, inputs, timeout=480)
    _save(link, out)
