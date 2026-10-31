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
VOICE_NAME = "Dahsha Saudi Dialect"   # colloquial Saudi voice (auto-pick fallback)
CHANNEL_VOICE = "Omar - Hijazi"        # the channel's voice, chosen by the owner
SETTINGS = {"stability": 0.36, "similarity_boost": 0.8, "style": 0.4, "use_speaker_boost": True}  # chatty, natural


def _headers(key: str) -> dict:
    return {"xi-api-key": key, "Content-Type": "application/json"}


DIALECT_WORDS = ("saudi", "najdi", "hejazi", "hijazi", "gulf", "khaleeji", "khaliji", "emirati", "kuwaiti")


def _is_dialect(v: dict) -> bool:
    text = " ".join(str(v.get(k, "")) for k in ("accent", "name", "description", "descriptive")).lower()
    return any(w in text for w in DIALECT_WORDS) and "standard" not in str(v.get("accent", "")).lower()


def _pick_shared_voice(key: str) -> dict | None:
    """A male voice that speaks colloquial Saudi/Gulf Arabic (not Modern Standard),
    most used first; falls back to any Arabic male voice."""
    found, fallback = [], None
    for params in ({"language": "ar", "gender": "male", "search": "saudi"},
                   {"language": "ar", "gender": "male", "search": "najdi"},
                   {"language": "ar", "gender": "male", "search": "gulf"},
                   {"language": "ar", "gender": "male"}):
        for page in range(3):
            resp = requests.get(f"{API}/v1/shared-voices", headers=_headers(key), timeout=30,
                                params={"page_size": 100, "page": page, "sort": "cloned_by_count", **params})
            if not resp.ok:
                break
            voices = resp.json().get("voices", [])
            if not voices:
                break
            fallback = fallback or voices[0]
            found += [v for v in voices if _is_dialect(v)]
        if found:
            break
    # prefer voices that describe themselves as everyday dialect over formal narrators
    def colloquial(v):
        name = str(v.get("name", "")).lower() + " " + str(v.get("description", "")).lower()
        return (3 * ("dialect" in name) + 2 * ("authentic" in name) + 2 * ("natural" in name)
                + ("conversational" in name) - ("narrator" in name))
    found.sort(key=colloquial, reverse=True)   # stable: popularity order kept within a score
    for v in found[:8]:
        print(f"[voice] candidate: {v.get('name')} | {v.get('accent')} | {v.get('locale')}")
    return found[0] if found else fallback


def _norm(text: str) -> str:
    import re
    return re.sub(r"[^a-z\u0600-\u06ff]", "", str(text).lower())


SPELLINGS = {"abdulrahman": ["Abdulrahman", "Abdul Rahman", "Abdelrahman", "Abdurrahman", "Abdalrahman"],
             "najdi": ["Najdi", "Najd", "Riyadh", "Saudi Najdi", "نجدي"]}


def _find_shared_by_name(key: str, wanted: str) -> dict | None:
    """A library voice whose name matches `wanted` (spacing and spelling variants allowed),
    preferring Saudi / Gulf accents."""
    base = wanted.split(" - ")[0]
    queries = SPELLINGS.get(_norm(base), [base])
    targets = {_norm(q) for q in queries} | {_norm(base)}
    matches = []
    for q in queries:
        resp = requests.get(f"{API}/v1/shared-voices", headers=_headers(key), timeout=30,
                            params={"page_size": 100, "language": "ar", "search": q})
        if not resp.ok:
            continue
        for v in resp.json().get("voices", []):
            # match the name, or the accent / description (e.g. "najdi")
            text = _norm(v.get("name", "")) + _norm(v.get("accent", "")) + _norm(v.get("description", ""))
            if any(t in text for t in targets) and v not in matches:
                matches.append(v)
    if not matches:
        return None
    matches.sort(key=lambda v: (not _is_dialect(v), -int(v.get("cloned_by_count") or 0)))
    for v in matches[:5]:
        print(f"[voice] match: {v.get('name')} | {v.get('accent')} | {v.get('locale')}")
    return matches[0]


def voice_id(key: str) -> str:
    chosen = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
    if chosen:
        return chosen
    pick = os.environ.get("ELEVENLABS_VOICE_PICK", "").strip() or CHANNEL_VOICE
    name = f"Dahsha {pick}"[:50] if pick else VOICE_NAME
    resp = requests.get(f"{API}/v1/voices", headers=_headers(key), timeout=30)
    resp.raise_for_status()
    for v in resp.json().get("voices", []):
        if v.get("name") == name:
            return v["voice_id"]
    shared = _find_shared_by_name(key, pick) if pick else _pick_shared_voice(key)
    if not shared:
        raise RuntimeError("no Arabic voice found in the ElevenLabs library")
    print(f"[voice] choosing '{shared.get('name')}' ({shared.get('accent')}, {shared.get('locale')})")
    added = requests.post(f"{API}/v1/voices/add/{shared['public_owner_id']}/{shared['voice_id']}",
                          headers=_headers(key), json={"new_name": name}, timeout=30)
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
