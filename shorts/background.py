"""Vertical background footage: free Pexels stock clips, or a moving gradient."""
import random
from pathlib import Path

import requests

from .media import run

PALETTES = [
    ("0x0f2027", "0x2c5364", "0x203a43"),
    ("0x1a002e", "0x5b247a", "0x1bcedf"),
    ("0x000428", "0x004e92", "0x00203f"),
    ("0x141e30", "0x243b55", "0x3a1c71"),
    ("0x0b3d2e", "0x11998e", "0x062a1f"),
]


def _pick_file(video: dict) -> str | None:
    files = [f for f in video.get("video_files", [])
             if f.get("height") and f.get("width") and f["height"] > f["width"] and 1280 <= f["height"] <= 2160]
    if not files:
        return None
    return min(files, key=lambda f: abs(f["height"] - 1920))["link"]


def fetch_pexels(terms: list[str], api_key: str, workdir: Path, want: int = 3) -> list[Path]:
    clips: list[Path] = []
    seen: set[int] = set()
    for term in terms:
        if len(clips) >= want:
            break
        try:
            resp = requests.get(
                "https://api.pexels.com/videos/search",
                params={"query": term, "orientation": "portrait", "per_page": 15},
                headers={"Authorization": api_key}, timeout=20)
            resp.raise_for_status()
            videos = [v for v in resp.json().get("videos", []) if v["id"] not in seen and 4 <= v.get("duration", 0) <= 60]
            random.shuffle(videos)
            for video in videos:
                link = _pick_file(video)
                if not link:
                    continue
                out = workdir / f"stock_{len(clips)}.mp4"
                with requests.get(link, stream=True, timeout=60) as r:
                    r.raise_for_status()
                    with open(out, "wb") as fh:
                        for part in r.iter_content(1 << 20):
                            fh.write(part)
                seen.add(video["id"])
                clips.append(out)
                break
        except requests.RequestException as exc:
            print(f"[background] pexels '{term}' failed: {exc}")
    return clips


def gradient(seconds: float, workdir: Path, width: int, height: int) -> Path:
    c0, c1, c2 = random.choice(PALETTES)
    out = workdir / "bg.mp4"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i",
         f"gradients=s={width}x{height}:r=30:c0={c0}:c1={c1}:c2={c2}:nb_colors=3:speed=0.015:d={seconds:.2f}",
         "-vf", "noise=alls=6:allf=t", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(out)])
    return out


def build(terms: list[str], api_key: str, seconds: float, workdir: Path, width: int, height: int) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    clips = fetch_pexels(terms, api_key, workdir) if api_key else []
    if not clips:
        return gradient(seconds, workdir, width, height)

    per_clip = seconds / len(clips) + 0.5
    parts = []
    for i, clip in enumerate(clips):
        part = workdir / f"norm_{i}.mp4"
        run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(clip), "-t", f"{per_clip:.2f}", "-an",
             "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                    "setsar=1,fps=30,eq=brightness=-0.06:saturation=1.15",
             "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(part)])
        parts.append(part)
    listing = workdir / "bg_list.txt"
    listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
    out = workdir / "bg.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])
    return out
