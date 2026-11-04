"""The channel character's reusable moves (image-to-video, made once, reused in every video).
Each clip is the owner's drawing animated on a solid magenta background (keyed out later:
the character has no magenta, so its teal jacket stays intact).
Usage: python scripts/mascot_clip.py [move ...]   (default: every move not made yet)"""
import base64
import io
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image  # noqa: E402

from shorts import replicate  # noqa: E402

KEY = (255, 0, 255)
BASE = ("same cartoon character, same design and colors, flat 2D cartoon animation, smooth natural "
        "motion, static camera, full body stays in frame, plain solid magenta background. "
        "His mouth stays closed the whole time in his confident sly smile; he never talks or opens "
        "his mouth. ")
MOVES = {
    "talk": "he explains with calm lively hand gestures like a presenter, small head nods",
    "greet": "he waves hello to the camera with one hand, friendly",
    "surprised": "he is amazed, eyes wide, eyebrows up, both hands up near his face, leans back",
    "point": "he points to the side with one arm as if showing something on screen, confident",
    "think": "he thinks with a hand on his chin, looking up, eyebrows moving, curious",
    "ask": "he opens both hands toward the camera with a shrug as if asking, raised eyebrows",
    "excited": "he gestures excitedly with both hands, leaning forward, big eyebrows",
}


def start_image() -> str:
    char = Image.open(ROOT / "assets/mascot/base.png").convert("RGBA")
    canvas = Image.new("RGBA", (720, 1280), KEY + (255,))
    char.thumbnail((620, 1080), Image.LANCZOS)
    canvas.alpha_composite(char, ((720 - char.width) // 2, 1280 - char.height - 90))
    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, "JPEG", quality=95)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main() -> None:
    out = ROOT / "output" / "mascot"
    out.mkdir(parents=True, exist_ok=True)
    have = ROOT / "assets" / "mascot" / "clips"
    wanted = sys.argv[1:] or list(MOVES)
    img = start_image()
    for i, move in enumerate(wanted):
        if i:
            time.sleep(15)          # Replicate allows few requests per minute on a small balance
        try:
            replicate.animate(img, BASE + MOVES[move], out / f"{move}.mp4")
            print(f"[mascot] {move} ok")
        except Exception as exc:
            print(f"[mascot] {move} failed: {str(exc)[:200]}")
    # contact sheet of every clip, keyed over a dark background, to review at a glance
    clips = sorted(out.glob("*.mp4"))
    for c in clips:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(c), "-vf",
                        "colorkey=0xFF00FF:0.32:0.08,format=rgba,"
                        "pad=iw:ih:0:0:0x1b2233,fps=2,scale=180:-1,tile=6x1",
                        "-frames:v", "1", str(out / f"sheet_{c.stem}.jpg")])


if __name__ == "__main__":
    main()
