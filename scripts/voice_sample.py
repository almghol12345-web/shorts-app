"""Short voice samples to compare spellings (e.g. how the voice says the letter qaf).
Writes output/voice/<name>.mp3 for each variant and one combined file with a beep between."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts import darijat  # noqa: E402

SAMPLE = "قَال: القَهْوَة قَدِيمَة.. وْالقِصَّة صَارَت فِي القَرْيَة"
VARIANTS = {
    "a1": "لَوِطَّلَعْتَ عَلَيْهِمْ.. لَوَلَّيْتَ مِنْهُمْ فِرَارَا.",     # spelled as spoken (joined)
    "a2": "لَوْ اِطَّلَعْتَ عَلَيْهِمْ.. لَوَلَّيْتَ مِنْهُمْ فِرَارَا.",
    "b1": "وَلَمَّا أَخْرَجَ العُمْلَة.. إِجْتَمَعَ النَّاسُ مِنْ حَوْلِهِ مُنْدَهِشِين.",
    "b2": "وَلَمَّا أَخْرَجَ العُمْلَةَ اجْتَمَعَ النَّاسُ مِنْ حَوْلِهِ مُنْدَهِشِين.",
}


def main() -> None:
    out = ROOT / "output" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    parts = []
    beep = out / "beep.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=880:d=0.4",
                    "-af", "volume=0.3,apad=pad_dur=0.6", "-ar", "44100", "-ac", "1", str(beep)], check=True)
    for name, text in VARIANTS.items():
        f = out / f"{name}.mp3"
        darijat.generate(text, f)
        print(f"[voice] {name}: {text}")
        parts += [beep, f]
    listing = out / "list.txt"
    listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", str(out / "compare.mp3")], check=True)


if __name__ == "__main__":
    main()
