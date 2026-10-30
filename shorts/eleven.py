"""Natural human-sounding narration with ElevenLabs (used when ELEVENLABS_API_KEY is set).

- Picks a natural Saudi/Gulf male voice from the ElevenLabs voice library on first use
  and keeps it in the account as "Dahsha Narrator", so every video has the same voice.
  ELEVENLABS_VOICE_ID overrides the choice.
- Uses the with-timestamps endpoint so captions still match every spoken word.
"""
import base64
import os
from pathlib import Path

import requests

API = "https://api.elevenlabs.io"
MODEL = "eleven_multilingual_v2"
VOICE_NAME = "Dahsha Narrator"
SETTINGS = {"stability": 0.42, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True}


def _headers(key: str) -> dict:
    return {"xi-api-key": key, "Content-Type": "application/json"}


def _pick_shared_voice(key: str) -> dict | None:
    """A male Saudi (else Gulf, else any Arabic) voice suited to narration, most used first."""
    tries = [
        {"language": "ar", "gender": "male", "accent": "saudi"},
        {"language": "ar", "gender": "male", "search": "saudi"},
        {"language": "ar", "gender": "male", "search": "gulf"},
        {"language": "ar", "gender": "male", "use_cases": "narrative_story"},
        {"language": "ar", "gender": "male"},
    ]
    for params in tries:
        resp = requests.get(f"{API}/v1/shared-voices", headers=_headers(key), timeout=30,
                            params={"page_size": 30, "sort": "cloned_by_count", **params})
        if not resp.ok:
            continue
        voices = resp.json().get("voices", [])
        if voices:
            return voices[0]
    return None


def voice_id(key: str) -> str:
    chosen = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
    if chosen:
        return chosen
    resp = requests.get(f"{API}/v1/voices", headers=_headers(key), timeout=30)
    resp.raise_for_status()
    for v in resp.json().get("voices", []):
        if v.get("name") == VOICE_NAME:
            return v["voice_id"]
    shared = _pick_shared_voice(key)
    if not shared:
        raise RuntimeError("no Arabic voice found in the ElevenLabs library")
    print(f"[voice] choosing '{shared.get('name')}' ({shared.get('accent')}, {shared.get('locale')})")
    added = requests.post(f"{API}/v1/voices/add/{shared['public_owner_id']}/{shared['voice_id']}",
                          headers=_headers(key), json={"new_name": VOICE_NAME}, timeout=30)
    added.raise_for_status()
    return added.json()["voice_id"]


def words_from_alignment(alignment: dict):
    """Turn per-character timings into per-word (text, start, end)."""
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])
    words, cur, t0, t1 = [], "", None, None
    for ch, a, b in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append((cur, t0, t1))
            cur, t0 = "", None
            continue
        if t0 is None:
            t0 = a
        cur += ch
        t1 = b
    if cur:
        words.append((cur, t0, t1))
    # captions only show tokens with letters or digits (same rule as the script lines)
    return [w for w in words if any(c.isalnum() for c in w[0])]


def synthesize(text: str, out: Path, key: str):
    """Writes an mp3 to `out` and returns [(word, start, end), ...]."""
    vid = voice_id(key)
    resp = requests.post(f"{API}/v1/text-to-speech/{vid}/with-timestamps",
                         params={"output_format": "mp3_44100_128"}, headers=_headers(key),
                         json={"text": text, "model_id": MODEL, "voice_settings": SETTINGS},
                         timeout=180)
    resp.raise_for_status()
    data = resp.json()
    out.write_bytes(base64.b64decode(data["audio_base64"]))
    return words_from_alignment(data.get("alignment") or data.get("normalized_alignment") or {})
