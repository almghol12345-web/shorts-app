"""Generates candidate designs for the channel's narrator character (one-time, high quality).
Saves output/mascot/<name>.jpg; the workflow publishes them on the 'mascot' branch."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts import replicate  # noqa: E402

from shorts.background import DOODLE_STYLE  # noqa: E402

# Channel picture in the look of the Quran-story videos (dark cinematic drawings)
STYLE = ("dark cinematic epic mood, deep shadows and dramatic warm light, centered bold composition that "
         "reads well as a small round channel avatar, no people's faces, " + DOODLE_STYLE)
DESIGNS = {
    "1_cave_lantern": "a lone figure in silhouette holding a glowing lantern at the mouth of a mountain cave "
                      "under a starry night sky",
    "2_crescent_book": "a glowing ancient open book on a desert dune under a big golden crescent moon and stars",
    "3_cave_light": "a dark mountain cave entrance at night with warm golden light shining from inside, stars above",
    "4_lantern": "a single ornate Arabian lantern glowing warm gold in deep darkness with tiny stars around it",
}


def main() -> None:
    out = Path("output/mascot")
    out.mkdir(parents=True, exist_ok=True)
    for name, desc in DESIGNS.items():
        try:
            replicate.image(f"{desc}, {STYLE}", out / f"{name}.jpg", "1:1")
            print(f"[mascot] {name} ok")
        except Exception as exc:
            print(f"[mascot] {name} failed: {str(exc)[:200]}")


if __name__ == "__main__":
    main()
