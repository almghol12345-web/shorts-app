"""Try ElevenLabs Arabic voices on the first lines of a script.

python scripts/eleven_pick.py list                 -> print Arabic male voices from the shared library
python scripts/eleven_pick.py "<topic>" [N]        -> synthesize the first 3 lines with the top N voices
                                                     into output/voice/e1.mp3 ... (names in output/voice/names.txt)
Needs ELEVENLABS_API_KEY.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.elevenlabs.io"
KEY = os.environ.get("ELEVENLABS_API_KEY", "")
MODEL = os.environ.get("ELEVEN_MODEL", "eleven_multilingual_v2")


def call(path, body=None, raw=False):
    req = urllib.request.Request(API + path, headers={"xi-api-key": KEY, "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body is not None else None,
                                 method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if raw else json.loads(data)


def arabic_voices(limit=20):
    """Arabic male library voices; ELEVEN_SEARCH="saudi,khaleeji,gulf" narrows by accent words,
    ELEVEN_SKIP="id1,id2" drops voices already tried."""
    skip = set(filter(None, os.environ.get("ELEVEN_SKIP", "").split(",")))
    terms = [t.strip() for t in os.environ.get("ELEVEN_SEARCH", "").split(",") if t.strip()] or [""]
    seen, voices = set(), []
    for term in terms:
        params = {"language": "ar", "gender": "male", "page_size": max(limit, 50), "sort": "usage_character_count_1y"}
        if term:
            params["search"] = term
        for v in call(f"/v1/shared-voices?{urllib.parse.urlencode(params)}").get("voices", []):
            want = os.environ.get("ELEVEN_NAME", "").lower()
            if want and want not in v.get("name", "").lower():
                continue
            if v["voice_id"] not in seen and v["voice_id"] not in skip:
                seen.add(v["voice_id"]); voices.append(v)
    return voices


def speak(voice_id, text, out):
    audio = call(f"/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                 {"text": text, "model_id": MODEL,
                  "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.3}}, raw=True)
    Path(out).write_bytes(audio)


def main():
    if not KEY:
        sys.exit("ELEVENLABS_API_KEY is missing")
    if sys.argv[1] == "list":
        for v in arabic_voices(30):
            print(v.get("voice_id"), "|", v.get("name"), "|", v.get("accent"), "|", v.get("age"),
                  "|", v.get("use_case"), "|", (v.get("description") or "")[:80])
        return
    topic, n = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 4
    text = os.environ.get("ELEVEN_TEXT", "").strip()
    entry = None if text else next(e for e in json.loads(Path("data/requests.json").read_text(encoding="utf-8")) if e["topic"] == topic)
    text = text or " ".join(entry["lines"][:int(os.environ.get("ELEVEN_LINES", "3"))])
    out = Path("output/voice"); out.mkdir(parents=True, exist_ok=True)
    names, i = [], 0
    for v in arabic_voices(20):
        if i >= n:
            break
        vid = v["voice_id"]
        try:
            speak(vid, text, out / f"{os.environ.get('ELEVEN_TAG', 'e')}{i + 1}.mp3")
        except Exception as err:  # library voice may need adding to the account first
            try:
                call(f"/v1/voices/add/{v['public_owner_id']}/{vid}", {"new_name": v["name"][:40]})
                speak(vid, text, out / f"{os.environ.get('ELEVEN_TAG', 'e')}{i + 1}.mp3")
            except Exception as err2:
                print("skip", v.get("name"), err, err2)
                continue
        i += 1
        names.append(f"e{i}.mp3 = {v.get('name')} | {v.get('accent')} | {vid}")
        print(names[-1])
    (out / f"names{os.environ.get('ELEVEN_TAG', '')}.txt").write_text("\n".join(names), encoding="utf-8")


if __name__ == "__main__":
    main()
