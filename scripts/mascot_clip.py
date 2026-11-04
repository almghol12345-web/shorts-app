"""One test clip of the channel's character talking (image-to-video), for the owner's review.
Writes output/mascot/talk_raw.mp4 (green background) and talk_preview.mp4 (keyed over a scene)."""
import base64
import io
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image  # noqa: E402

from shorts import replicate  # noqa: E402

GREEN = (0, 177, 64)
PROMPT = ("the cartoon character talks to the camera like a storyteller, explaining with lively hand "
          "gestures, mouth opening and closing as he speaks, small head nods, friendly expressions, "
          "same character design and colors, flat 2D cartoon animation, smooth motion, static camera, "
          "plain solid green background")


def main() -> None:
    out = ROOT / "output" / "mascot"
    out.mkdir(parents=True, exist_ok=True)
    char = Image.open(ROOT / "assets/mascot/base.png").convert("RGBA")
    canvas = Image.new("RGBA", (720, 1280), GREEN + (255,))
    char.thumbnail((640, 1100), Image.LANCZOS)
    canvas.alpha_composite(char, ((720 - char.width) // 2, 1280 - char.height - 60))
    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, "JPEG", quality=95)
    (out / "start.jpg").write_bytes(buf.getvalue())
    data_uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    raw = out / "talk_raw.mp4"
    replicate.animate(data_uri, PROMPT, raw)
    print("[mascot] clip ready")
    # preview: green keyed out, character over a dark scene, as it would sit in a Short
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x1b2233:s=1080x1920:d=6",
                    "-i", str(raw), "-filter_complex",
                    "[1:v]scale=-2:1100,chromakey=0x00B140:0.13:0.06,despill=green[c];"
                    "[0:v][c]overlay=(W-w)/2:H-h-120:shortest=1[v]",
                    "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out / "talk_preview.mp4")],
                   check=True)
    print("[mascot] preview ready")


if __name__ == "__main__":
    main()
