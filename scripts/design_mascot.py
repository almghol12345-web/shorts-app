"""Generates candidate designs for the channel's narrator character (one-time, high quality).
Saves output/mascot/<name>.jpg; the workflow publishes them on the 'mascot' branch."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts import replicate  # noqa: E402

STYLE = ("3D animated cartoon character, Pixar style, friendly expressive face, big eyes, "
         "full upper body facing the camera, simple dark studio background with soft rim light, "
         "high detail, no text")
DESIGNS = {
    "1_saudi_storyteller": "a young Saudi man storyteller wearing a white thobe and red-and-white shemagh, "
                           "short neat beard, warm smile, holding an old glowing book",
    "2_grandfather": "a kind old Bedouin grandfather storyteller with a grey beard, brown bisht cloak and "
                     "white ghutra, sitting by a small campfire, wise curious eyes",
    "3_detective_owl": "a cute owl detective wearing a small shemagh and a magnifying glass, curious "
                       "expression, mysterious adventurer",
    "4_explorer": "a young Saudi explorer with a desert scarf, explorer jacket and a lantern, excited "
                  "adventurous expression, mysteries around him",
}


def main() -> None:
    os.environ.setdefault("REPLICATE_IMAGE_MODEL", "black-forest-labs/flux-1.1-pro")
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
