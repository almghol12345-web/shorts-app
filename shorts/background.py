"""Visuals that follow the narration: one shot per spoken line.

Each line has a visual spec:
  "ai:<scene> >> <fallback spec>" an illustration generated for that exact scene, in one
                                 consistent dark anime/cinematic style per video; if the
                                 generator fails, the fallback spec below is used.
  "wiki:<search>|<stock query>"  a real photo of the subject from Wikimedia Commons
                                 (free licences, credited in the description), shown
                                 with a slow zoom; falls back to the stock query.
  "<stock query>"                a mood clip from Pixabay (or Pexels), best tag match.
Anything that cannot be fetched falls back to a dark animated gradient.
"""
import html
import random
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote

import requests

from .media import run

UA = {"User-Agent": "DahshaShorts/1.0 (https://github.com/almghol12345-web/shorts-app)"}
GRADE = "eq=brightness=-0.09:saturation=0.6:contrast=1.08,colorbalance=bs=0.10:bm=0.04"
ENCODE = ["-an", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p"]

PALETTES = [  # dark, cold tones for a mysterious mood
    ("0x05070d", "0x14213a", "0x0a0f1c"),
    ("0x0a0612", "0x2a1438", "0x07040c"),
    ("0x03100f", "0x0f2d2a", "0x020807"),
    ("0x100505", "0x2e0d0d", "0x080303"),
]


# One look for the whole channel: illustrated, dark and cinematic (clearly not photoreal).
ART_STYLE = ("dark cinematic anime illustration, painterly digital art, dramatic moody lighting, "
             "deep shadows, muted colors with a red accent, highly detailed, atmospheric fog, "
             "vertical composition, no watermark")


@dataclass
class Sources:
    pexels_key: str = ""
    pixabay_key: str = ""
    credits: list[str] = field(default_factory=list)
    used_ids: set = field(default_factory=set)
    last_credit: str = ""
    seed: int = field(default_factory=lambda: random.randint(1, 10**6))
    ai_images: int = 0


def _download(link: str, out: Path) -> None:
    with requests.get(link, stream=True, timeout=60, headers=UA) as r:
        r.raise_for_status()
        with open(out, "wb") as fh:
            for part in r.iter_content(1 << 20):
                fh.write(part)


STOP = {"the", "and", "with", "from", "for", "dark", "night", "old"}
MOOD_FALLBACK = "dark fog night"
# Graphic/abstract clips break the documentary mood.
BANNED_TAGS = {"abstract", "neon", "animation", "animated", "background", "backgrounds", "loop",
               "render", "particles", "cartoon", "graphic", "graphics", "geometric", "vj", "3d",
               "motion", "wallpaper", "glitch", "hologram", "futuristic"}


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[^\W_]+", text.lower()) if len(w) > 2 and w not in STOP}


def relevant(title: str, query: str) -> bool:
    """A photo counts only if its file name names the subject, e.g. both
    'baghdad' and 'battery' for "Baghdad Battery copper cylinder"."""
    want = [w for w in re.findall(r"[^\W_]+", query.lower()) if len(w) > 2 and w not in STOP]
    need = min(2, len(want))
    return len(set(want) & _words(title)) >= need


# ---------- Wikimedia Commons: real photos of the subject ----------

def fetch_commons(query: str, out: Path, src: Sources) -> bool:
    resp = requests.get("https://commons.wikimedia.org/w/api.php", headers=UA, timeout=20, params={
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 8,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 1600,
    })
    resp.raise_for_status()
    pages = sorted(resp.json().get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    good = [p for p in pages
            if (p.get("imageinfo") or [{}])[0].get("mime") in ("image/jpeg", "image/png")
            and (p.get("imageinfo") or [{}])[0].get("width", 0) >= 500
            and relevant(p["title"], query)]
    # Prefer a photo not used yet; otherwise reuse a relevant one rather than show something unrelated.
    fresh = [p for p in good if p["title"] not in src.used_ids]
    for page in (fresh or good)[:1]:
        info = page["imageinfo"][0]
        _download(info.get("thumburl") or info["url"], out)
        meta = info.get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", html.unescape(meta.get("Artist", {}).get("value", ""))).strip()
        licence = meta.get("LicenseShortName", {}).get("value", "")
        credit = f"{page['title'].removeprefix('File:')} — {artist or 'Unknown'} ({licence}), Wikimedia Commons"
        if credit not in src.credits:
            src.credits.append(credit)
        src.last_credit = credit
        src.used_ids.add(page["title"])
        return True
    return False


def photo_clip(image: Path, seconds: float, out: Path, width: int, height: int,
               zoom_in: bool = True) -> None:
    """Photo on a blurred copy of itself, with a slow zoom in or out (Ken Burns)."""
    frames = int(seconds * 30) + 1
    zoom = "min(1+0.0011*on,1.2)" if zoom_in else "max(1.2-0.0011*on,1)"
    vf = (f"[0:v]split=2[a][b];"
          f"[a]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
          f"boxblur=25:2,eq=brightness=-0.25[bg];"
          # the photo fills about two thirds of the screen (sides trimmed if needed)
          f"[b]scale={width}:{int(height * 0.66)}:force_original_aspect_ratio=increase,"
          f"crop='min(iw,{width})':'min(ih,{int(height * 0.66)})'[fg];"
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,"
          f"zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2'"
          f":d={frames}:s={width}x{height}:fps=30,{GRADE}[v]")
    run(["ffmpeg", "-y", "-i", str(image), "-filter_complex", vf, "-map", "[v]",
         "-t", f"{seconds:.3f}", *ENCODE, str(out)])


# ---------- AI illustrations ----------

def fetch_ai_image(scene: str, out: Path, src: Sources, width: int, height: int,
                   attempts: int = 3) -> bool:
    """Free image generation (Pollinations, no key). Same seed for the whole
    video keeps the look consistent from shot to shot."""
    url = (f"https://image.pollinations.ai/prompt/{quote(f'{scene}, {ART_STYLE}')}"
           f"?width={width}&height={height}&seed={src.seed}&model=flux&nologo=true&private=true")
    for attempt in range(attempts):
        try:
            resp = requests.get(url, headers=UA, timeout=150)
            if resp.ok and resp.headers.get("content-type", "").startswith("image/") and len(resp.content) > 20_000:
                out.write_bytes(resp.content)
                src.ai_images += 1
                return True
            print(f"[visual] ai image attempt {attempt + 1}: HTTP {resp.status_code}")
        except requests.RequestException as exc:
            print(f"[visual] ai image attempt {attempt + 1}: {type(exc).__name__}")
        time.sleep(5 * (attempt + 1))
    return False


def art_clip(image: Path, seconds: float, out: Path, width: int, height: int, index: int) -> None:
    """Full-screen illustration with a slow push-in or pull-out and a gentle drift."""
    frames = int(seconds * 30) + 1
    zoom = "min(1+0.0012*on,1.18)" if index % 2 == 0 else "max(1.18-0.0012*on,1)"
    drift = "+on*0.15" if index % 3 == 0 else "-on*0.15" if index % 3 == 1 else ""
    vf = (f"scale={width * 2}:{height * 2}:force_original_aspect_ratio=increase,"
          f"crop={width * 2}:{height * 2},setsar=1,"
          f"zoompan=z='{zoom}':x='iw/2-iw/zoom/2{drift}':y='ih/2-ih/zoom/2'"
          f":d={frames}:s={width}x{height}:fps=30,eq=contrast=1.05:saturation=0.9")
    run(["ffmpeg", "-y", "-i", str(image), "-vf", vf, "-t", f"{seconds:.3f}", *ENCODE, str(out)])


# ---------- Stock video: mood shots ----------

def _pick_pexels_file(video: dict) -> str | None:
    files = [f for f in video.get("video_files", [])
             if f.get("height") and f.get("width") and f["height"] > f["width"] and 1280 <= f["height"] <= 2160]
    if not files:
        return None
    return min(files, key=lambda f: abs(f["height"] - 1920))["link"]


def fetch_pixabay(query: str, out: Path, src: Sources) -> bool:
    resp = requests.get("https://pixabay.com/api/videos/", timeout=20, params={
        "key": src.pixabay_key, "q": query, "per_page": 30, "safesearch": "true"})
    resp.raise_for_status()
    want = _words(query)
    best, best_score = None, -1
    for hit in resp.json().get("hits", []):  # already ordered by relevance
        if hit["id"] in src.used_ids or not 3 <= hit.get("duration", 0) <= 60:
            continue
        if _words(hit.get("tags", "")) & BANNED_TAGS and not _words(query) & BANNED_TAGS:
            continue
        score = len(want & _words(hit.get("tags", "")))
        if score > best_score:
            best, best_score = hit, score
    if not best or best_score < 1:  # nothing actually tagged like the query
        return False
    sizes = [v for v in best.get("videos", {}).values() if v.get("url") and v.get("height", 0) >= 720]
    if not sizes:
        return False
    choice = min(sizes, key=lambda v: (v["height"] <= v["width"], v["height"]))
    _download(choice["url"], out)
    src.used_ids.add(best["id"])
    return True


def fetch_pexels(query: str, out: Path, src: Sources) -> bool:
    resp = requests.get("https://api.pexels.com/videos/search", timeout=20,
                        params={"query": query, "orientation": "portrait", "per_page": 15},
                        headers={"Authorization": src.pexels_key})
    resp.raise_for_status()
    for video in resp.json().get("videos", []):
        link = _pick_pexels_file(video)
        if link and video["id"] not in src.used_ids and 3 <= video.get("duration", 0) <= 60:
            _download(link, out)
            src.used_ids.add(video["id"])
            return True
    return False


def video_clip(video: Path, seconds: float, out: Path, width: int, height: int) -> None:
    run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(video), "-t", f"{seconds:.3f}",
         "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                f"setsar=1,fps=30,{GRADE},"
                f"zoompan=z='min(1+0.0012*on,1.12)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1"
                f":s={width}x{height}:fps=30",
         *ENCODE, str(out)])


def gradient(seconds: float, out: Path, width: int, height: int) -> None:
    c0, c1, c2 = random.choice(PALETTES)
    run(["ffmpeg", "-y", "-f", "lavfi", "-i",
         f"gradients=s={width}x{height}:r=30:c0={c0}:c1={c1}:c2={c2}:nb_colors=3:speed=0.015:d={seconds:.3f}",
         "-vf", "noise=alls=6:allf=t", *ENCODE, str(out)])


# ---------- Timeline ----------

def shot(spec: str, seconds: float, out: Path, src: Sources, width: int, height: int,
         index: int = 0) -> None:
    """Make one shot for one line, trying the best source first."""
    raw = out.with_suffix(".src")
    if spec.startswith("ai:"):
        scene, _, fallback = spec[3:].partition(" >> ")
        if fetch_ai_image(scene.strip(), raw, src, width, height):
            art_clip(raw, seconds, out, width, height, index)
            print(f"[visual] {out.stem}: ai art for '{scene.strip()[:60]}'")
            return
        print(f"[visual] {out.stem}: ai art failed, using fallback")
        spec = fallback.strip() or MOOD_FALLBACK
    stock = spec
    if spec.startswith("wiki:"):
        wiki, _, stock = spec[5:].partition("|")
        try:
            if fetch_commons(wiki, raw, src):
                photo_clip(raw, seconds, out, width, height, zoom_in=index % 2 == 0)
                print(f"[visual] {out.stem}: photo {src.last_credit!r} for '{wiki}'")
                return
        except Exception as exc:
            print(f"[visual] commons '{wiki}' failed: {exc}")
    for query in dict.fromkeys(q for q in (stock, MOOD_FALLBACK) if q):
        for key, fetch in ((src.pixabay_key, fetch_pixabay), (src.pexels_key, fetch_pexels)):
            if not key:
                continue
            try:
                if fetch(query, raw, src):
                    video_clip(raw, seconds, out, width, height)
                    print(f"[visual] {out.stem}: stock video for '{query}'")
                    return
            except Exception as exc:
                print(f"[visual] stock '{query}' failed: {exc}")
    gradient(seconds, out, width, height)


def build(visuals: list[str], spans: list[float], workdir: Path, width: int, height: int,
          pexels_key: str = "", pixabay_key: str = "") -> tuple[Path, list[str]]:
    """One shot per line (spans = seconds each line is on screen). Returns the
    joined background video and the credit lines for the description."""
    workdir.mkdir(parents=True, exist_ok=True)
    src = Sources(pexels_key=pexels_key, pixabay_key=pixabay_key)
    parts = []
    for i, (spec, seconds) in enumerate(zip(visuals, spans)):
        part = workdir / f"shot_{i:02d}.mp4"
        shot(spec, max(seconds, 0.5), part, src, width, height, index=i)
        parts.append(part)
    listing = workdir / "shots.txt"
    listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
    out = workdir / "bg.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])
    credits = list(src.credits)
    if src.ai_images:
        credits.insert(0, "رسومات المشاهد مولّدة بالذكاء الاصطناعي.")
    return out, credits
