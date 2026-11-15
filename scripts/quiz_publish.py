"""Makes the next eye-challenge Short and publishes it (or only makes it with --no-upload).

    python scripts/quiz_publish.py [--no-upload] [--kind letters --seed 3]

The voice is the free standard voice with a fuller-Arabic question (the owner approved that
sound). Quizzes are drawn in code, so the illustrator gate does not apply; instead this script
refuses a repeated topic and a video that is the wrong length or has no voice.
"""
import argparse
import asyncio
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts import history as hist, quiz, rotation, upload, voice  # noqa: E402
from shorts.config import Config  # noqa: E402

TITLES = {
    "letters": "تحدّي العين: وين الحرف الغريب؟ 👀",
    "numbers": "تحدّي العين: وين الرقم الغريب؟ 🔢",
    "colors": "تحدّي العين: أي مربع لونه مختلف؟ 🎨",
}
HASHTAGS = "#تحدي #اختبار_العين #اختبار_ذكاء #shorts"
TAGS = ["تحدي", "اختبار العين", "اختبار ذكاء", "تحدي العين", "ألغاز", "shorts"]


def _probe(video: Path) -> tuple[float, bool]:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                          "-of", "json", str(video)], capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    return float(info["format"]["duration"]), any(s["codec_type"] == "audio" for s in info["streams"])


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--no-upload", action="store_true")
    p.add_argument("--kind", choices=list(quiz.KINDS))
    p.add_argument("--seed", type=int)
    a = p.parse_args()
    cfg = Config()
    history = hist.load(cfg.history_file)
    kind, seed, topic = rotation.next_quiz(history)
    if a.kind:
        kind, seed = a.kind, a.seed or seed
        topic = f"{rotation.QUIZ_PREFIX}{kind}:{seed}"
    if topic in hist.used_topics(cfg.history_file):
        sys.exit(f"[quiz] refused: «{topic}» was already published")
    out = ROOT / "output" / "quiz.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    intro = out.with_name("quiz_intro.mp3")
    asyncio.run(voice._tts(quiz.INTRO_BY_KIND[kind], cfg.voice, intro))
    quiz.render(out, seed, intro, kind)
    length, has_audio = _probe(out)
    print(f"[quiz] {topic}: {length:.1f}s, voice={'yes' if has_audio else 'NO'}")
    if not has_audio or not 30 <= length <= 60:
        sys.exit("[quiz] refused: the video is the wrong length or has no sound")
    if a.no_upload:
        return
    title = TITLES[kind]
    description = ("٥ مستويات.. وكل مستوى أصعب من اللي قبله. وصلت أي مستوى؟ اكتب رقمك بالتعليقات 👇\n\n"
                   + HASHTAGS)
    video_id = upload.upload_plain(cfg, f"{title} #تحدي #shorts", description, TAGS, out,
                                   comment="وصلت أي مستوى؟ اكتب رقمك 👇")
    print(f"[upload] https://youtu.be/{video_id}")
    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    hist.record(cfg.history_file, topic, title, video_id, journal=cfg.output_dir / "published.jsonl")


if __name__ == "__main__":
    main()
