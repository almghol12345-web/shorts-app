"""Lists the Darijat voices, or reads the same opening lines of a real script with each voice
given, so the owner can compare them by ear.

    python scripts/voice_pick.py list
    python scripts/voice_pick.py "topic" "voice one,voice two,..."
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from shorts import darijat  # noqa: E402
from shorts.spoken import speakable  # noqa: E402


def main() -> None:
    if sys.argv[1] == "list":
        import voice_sample
        voice_sample.list_voices()
        return
    topic, voices = sys.argv[1], [v.strip() for v in sys.argv[2].split(",") if v.strip()]
    script = next(s for s in json.loads((ROOT / "data/requests.json").read_text(encoding="utf-8"))
                  if s["topic"] == topic)
    text = speakable(" ".join(script["lines"][:3]))
    out = ROOT / "output" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    for n, voice in enumerate(voices, 1):
        os.environ["DARIJAT_VOICE"] = voice
        try:
            darijat.generate(text, out / f"{n}.mp3")
            print(f"[pick] {n} = {voice}")
        except Exception as exc:
            print(f"[pick] {n} = {voice} FAILED: {str(exc)[:150]}")


if __name__ == "__main__":
    main()
