"""Makes one eye-challenge video with a spoken opening question (needs the Darijat key)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts import darijat, quiz, voice  # noqa: E402
from shorts.spoken import speakable  # noqa: E402


def main() -> None:
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    out = Path("output/quiz.mp4")
    out.parent.mkdir(parents=True, exist_ok=True)
    intro = out.with_name("quiz_intro.mp3")
    spoken = speakable(quiz.INTRO_TEXT)
    print("[quiz] intro:", spoken)
    try:
        darijat.generate(spoken, intro)
    except Exception as err:
        import os
        if not os.environ.get("QUIZ_STANDARD_VOICE"):   # the standard voice sounds robotic: never by default
            raise
        print("[quiz] Darijat unavailable, using the standard voice:", str(err)[:120])
        import asyncio
        from shorts.config import Config
        asyncio.run(voice._tts(spoken, Config().voice, intro))
    for n, level in enumerate(quiz.render(out, seed, intro), 1):
        print(f"[quiz] level {n}: {level.odd} among {level.common}")


if __name__ == "__main__":
    main()
