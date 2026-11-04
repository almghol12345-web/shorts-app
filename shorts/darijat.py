"""Narration with Darijat (tts.darijat.com), an Arabic-dialect voice service, used when
DARIJAT_API_KEY is set.

API (V2): POST {DARIJAT_API_URL}/api/v2/external/generate-audio
          {"text": ..., "voice_name": ..., "speed": 1.0}
The service does not return word timings, so each script line is generated on its own:
the line's exact start/end come from the audio length, and words inside a line are spread
by their length. Captions therefore stay in sync line by line.
"""
import base64
import os
import subprocess
import time
from pathlib import Path

import requests

DEFAULT_URL = "https://tts.darijat.com"
PAUSE = 0.18          # breath between lines, seconds
GAP = 1.2             # seconds between requests (the service rate-limits bursts)
_last_call = [0.0]


def _cfg():
    return (os.environ.get("DARIJAT_API_URL", "").strip() or DEFAULT_URL).rstrip("/"), \
        os.environ.get("DARIJAT_API_KEY", "").strip(), \
        os.environ.get("DARIJAT_VOICE", "").strip() or "جسار"   # the channel voice, approved by the owner


def _save_audio(resp: requests.Response, out: Path, headers: dict) -> None:
    """The response may be the audio itself, or JSON with a URL or base64 audio."""
    ctype = resp.headers.get("content-type", "")
    if ctype.startswith("audio/") or ctype == "application/octet-stream":
        out.write_bytes(resp.content)
        return
    data = resp.json()
    payload = data.get("data", data) if isinstance(data, dict) else {}
    for key in ("audio_url", "url", "file_url", "audio_file", "download_url", "link"):
        link = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(link, str) and link.startswith("http"):
            got = requests.get(link, timeout=120)
            got.raise_for_status()
            out.write_bytes(got.content)
            return
    for key in ("audio", "audio_base64", "audioContent", "content"):
        b64 = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(b64, str) and len(b64) > 100:
            out.write_bytes(base64.b64decode(b64.split(",")[-1]))
            return
    keys = list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__
    raise RuntimeError(f"unexpected Darijat response (keys: {keys})")


def generate(text: str, out: Path) -> None:
    url, key, voice = _cfg()
    headers = {"Authorization": f"Bearer {key}", "X-API-Key": key, "api-key": key,
               "Content-Type": "application/json", "Accept": "audio/mpeg, application/json"}
    # the service limits how fast requests may come: space them out and wait out a 429
    for attempt in range(7):
        wait = _last_call[0] + GAP - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.time()
        resp = requests.post(f"{url}/api/v2/external/generate-audio", headers=headers, timeout=180,
                             json={"text": text, "voice_name": voice, "speed": 1.0})
        if resp.status_code in (429, 502, 503) and attempt < 6:
            pause = int(resp.headers.get("retry-after", "0") or 0) or 10 * (attempt + 1)
            print(f"[voice] Darijat busy ({resp.status_code}); waiting {pause}s")
            time.sleep(pause)
            continue
        break
    if not resp.ok:
        raise RuntimeError(f"Darijat HTTP {resp.status_code}: {resp.text[:300]}")
    _save_audio(resp, out, headers)


def _duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def synthesize(lines: list[str], out: Path, workdir: Path):
    """Writes one mp3 for the whole script and returns [(word, start, end), ...]."""
    workdir.mkdir(parents=True, exist_ok=True)
    parts, timed, t = [], [], 0.0
    gap = workdir / "gap.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                    "-t", f"{PAUSE}", "-c:a", "libmp3lame", str(gap)], check=True)
    for i, line in enumerate(lines):
        clip = workdir / f"line_{i:02d}.mp3"
        generate(line, clip)
        d = _duration(clip)
        words = [w for w in line.split() if any(c.isalnum() for c in w)]
        weights = [len(w) + 2 for w in words] or [1]
        total = sum(weights)
        cur = t + 0.05
        span = max(d - 0.1, 0.1)
        for w, k in zip(words, weights):
            dur = span * k / total
            timed.append((w, cur, cur + dur))
            cur += dur
        parts += [clip, gap]
        t += d + PAUSE
    listing = workdir / "lines.txt"
    listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "160k", str(out)], check=True)
    return timed
