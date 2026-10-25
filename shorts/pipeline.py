"""One full run: script -> voice -> background -> video -> (upload)."""
import re
import shutil
from datetime import datetime
from pathlib import Path

from . import background, content, history, render, voice
from .config import Config


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "short"


def make_one(cfg: Config, do_upload: bool, keep_work: bool = False) -> dict:
    used = history.used_topics(cfg.history_file)
    script = content.generate(cfg, used)
    print(f"[script] {script.title}")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"{stamp}-{_slug(script.topic)}"
    work = cfg.output_dir / "work" / name
    work.mkdir(parents=True, exist_ok=True)

    narration = voice.synthesize(script.lines, cfg.voice, work / "voice")
    print(f"[voice] {narration.length:.1f}s{' (silent placeholder)' if narration.silent else ''}")

    bg = background.build(script.search_terms, cfg.pexels_key, narration.length, work / "bg", cfg.width, cfg.height,
                          pixabay_key=cfg.pixabay_key)
    video = render.render(cfg, narration, bg, work, cfg.output_dir / f"{name}.mp4")
    print(f"[video] {video}")

    video_id = None
    if do_upload:
        if narration.silent:
            print("[upload] skipped: narration is silent (TTS was unavailable)")
        elif not cfg.can_upload:
            print("[upload] skipped: YouTube credentials are not configured")
        else:
            from .upload import upload
            video_id = upload(cfg, script, video)
            print(f"[upload] https://youtube.com/shorts/{video_id}")
            history.record(cfg.history_file, script.topic, script.title, video_id)

    if not keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return {"title": script.title, "video": str(video), "video_id": video_id}
