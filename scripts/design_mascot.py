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
         "reads well at a glance, no people's faces, " + DOODLE_STYLE)
DESIGNS = {
    "banner_cave": "a very wide panoramic night landscape: rugged mountains under a starry sky, a lone figure in "
                   "silhouette holding a glowing lantern at the mouth of a cave on the right side, the middle of "
                   "the sky left empty and dark for a title",
    "banner_desert": "a very wide panoramic night desert with dunes and distant mountains, a cave glowing warm "
                     "gold far away, a big golden crescent moon, stars, the middle of the sky left empty for a title",
}


def main() -> None:
    out = Path("output/mascot")
    out.mkdir(parents=True, exist_ok=True)
    for name, desc in DESIGNS.items():
        try:
            replicate.image(f"{desc}, {STYLE}", out / f"{name}.jpg", "16:9" if name.startswith("banner") else "1:1")
            print(f"[mascot] {name} ok")
        except Exception as exc:
            print(f"[mascot] {name} failed: {str(exc)[:200]}")


if __name__ == "__main__":
    main()
