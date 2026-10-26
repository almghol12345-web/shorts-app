"""Vertical background footage: free Pexels stock clips, or a moving gradient."""
import random
from pathlib import Path

import requests

from .media import run

PALETTES = [  # dark, cold tones for a mysterious mood
    ("0x05070d", "0x14213a", "0x0a0f1c"),
    ("0x0a0612", "0x2a1438", "0x07040c"),
    ("0x03100f", "0x0f2d2a", "0x020807"),
    ("0x100505", "0x2e0d0d", "0x080303"),
]


def _pick_file(video: dict) -> str | None:
    files = [f for f in video.get("video_files", [])
             if f.get("height") and f.get("width") and f["height"] > f["width"] and 1280 <= f["height"] <= 2160]
    if not files:
        return None
    return min(files, key=lambda f: abs(f["height"] - 1920))["link"]


def fetch_pexels(terms: list[str], api_key: str, workdir: Path, want: int = 7) -> list[Path]:
    clips: list[Path] = []
    seen: set[int] = set()
    for term in (terms * 3)[: want * 2]:
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
                _download(link, out)
                seen.add(video["id"])
                clips.append(out)
                break
        except requests.RequestException as exc:
            print(f"[background] pexels '{term}' failed: {exc}")
    return clips


def _download(link: str, out: Path) -> None:
    with requests.get(link, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(out, "wb") as fh:
            for part in r.iter_content(1 << 20):
                fh.write(part)


def fetch_pixabay(terms: list[str], api_key: str, workdir: Path, want: int = 7) -> list[Path]:
    """Free Pixabay videos. Most are landscape; they get center-cropped to vertical."""
    clips: list[Path] = []
    seen: set[int] = set()
    for term in (terms * 3)[: want * 2]:
        if len(clips) >= want:
            break
        try:
            resp = requests.get(
                "https://pixabay.com/api/videos/",
                params={"key": api_key, "q": term, "per_page": 20, "safesearch": "true"},
                timeout=20)
            resp.raise_for_status()
            hits = [h for h in resp.json().get("hits", []) if h["id"] not in seen and 4 <= h.get("duration", 0) <= 60]
            random.shuffle(hits)
            for hit in hits:
                sizes = [v for v in hit.get("videos", {}).values() if v.get("url") and v.get("height", 0) >= 720]
                if not sizes:
                    continue
                # Prefer portrait files, then the smallest one that is still HD.
                best = min(sizes, key=lambda v: (v["height"] <= v["width"], v["height"]))
                out = workdir / f"stock_{len(clips)}.mp4"
                _download(best["url"], out)
                seen.add(hit["id"])
                clips.append(out)
                break
        except requests.RequestException as exc:
            print(f"[background] pixabay '{term}' failed: {exc}")
    return clips


def gradient(seconds: float, workdir: Path, width: int, height: int) -> Path:
    c0, c1, c2 = random.choice(PALETTES)
    out = workdir / "bg.mp4"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i",
         f"gradients=s={width}x{height}:r=30:c0={c0}:c1={c1}:c2={c2}:nb_colors=3:speed=0.015:d={seconds:.2f}",
         "-vf", "noise=alls=6:allf=t", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(out)])
    return out


def build(terms: list[str], pexels_key: str, seconds: float, workdir: Path, width: int, height: int,
          pixabay_key: str = "") -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    clips = fetch_pexels(terms, pexels_key, workdir) if pexels_key else []
    if not clips and pixabay_key:
        clips = fetch_pixabay(terms, pixabay_key, workdir)
    if not clips:
        return gradient(seconds, workdir, width, height)

    per_clip = seconds / len(clips) + 0.5
    parts = []
    for i, clip in enumerate(clips):
        part = workdir / f"norm_{i}.mp4"
        run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(clip), "-t", f"{per_clip:.2f}", "-an",
             "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                    "setsar=1,fps=30,eq=brightness=-0.09:saturation=0.6:contrast=1.08,"
                    "colorbalance=bs=0.10:ms=0.04,"
                    f"zoompan=z='min(1+0.0015*on,1.15)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={width}x{height}:fps=30",
             "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(part)])
        parts.append(part)
    listing = workdir / "bg_list.txt"
    listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
    out = workdir / "bg.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])
    return out
