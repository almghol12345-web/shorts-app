"""Short voice samples to compare spellings (e.g. how the voice says the letter qaf).
Writes output/voice/<name>.mp3 for each variant and one combined file with a beep between."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts import darijat  # noqa: E402

SAMPLE = "قَال: القَهْوَة قَدِيمَة.. وْالقِصَّة صَارَت فِي القَرْيَة"
VOICE_TEXT = "تْخَيَّل القَمَر اخْتَفَى اللَّيْلِة.. شُو رَحْ يْصِير؟ أَوَّل شِي رَحْ تْلَاحِظ إِنُّو اللَّيْل صَار عَتْمِة كْتِير. وْبَعْدِين البَحِر.. المَدّ وْالجَزِر رَحْ يِضْعَف كْتِير."
# name -> (Darijat voice, text): the same lines in each Saudi voice, to compare by ear
VARIANTS = {
    "1_jassar": ("جسار", VOICE_TEXT),
    "2_turki": ("تركي", VOICE_TEXT),
    "3_faisal": ("فيصل", VOICE_TEXT),
    "4_fayez": ("فايز", VOICE_TEXT),
}


def list_voices() -> None:
    """Print the voices the service offers (to find dialects we have not tried)."""
    import requests
    url, key, _ = darijat._cfg()
    headers = {"Authorization": f"Bearer {key}", "X-API-Key": key, "api-key": key}
    for path in ("/api/v2/external/voices", "/api/v2/voices", "/api/v2/external/get-voices", "/api/voices"):
        try:
            r = requests.get(url + path, headers=headers, timeout=30)
            print(f"[voices] {path}: HTTP {r.status_code} {r.text[:3000]}")
            if r.ok:
                return
        except Exception as exc:
            print(f"[voices] {path}: {exc}")


def main() -> None:
    list_voices()
    out = ROOT / "output" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    parts = []
    beep = out / "beep.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=880:d=0.4",
                    "-af", "volume=0.3,apad=pad_dur=0.6", "-ar", "44100", "-ac", "1", str(beep)], check=True)
    import os
    for name, item in VARIANTS.items():
        voice, text = item if isinstance(item, tuple) else ("", item)
        if voice:
            os.environ["DARIJAT_VOICE"] = voice
        f = out / f"{name}.mp3"
        from shorts.spoken import speakable
        darijat.generate(speakable(text), f)      # same clean-up as real videos
        print(f"[voice] {name}: {text}")
        parts += [beep, f]
    listing = out / "list.txt"
    listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", str(out / "compare.mp3")], check=True)


if __name__ == "__main__":
    main()
