"""Publish a video that was already made and approved (no remake): the file from an earlier
run, with the title, description and hashtags of its script (by topic).

    python scripts/upload_existing.py <video.mp4> "<topic>"
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts import content, cover as cover_mod, upload  # noqa: E402
from shorts.config import Config  # noqa: E402


def main() -> None:
    video, topic = Path(sys.argv[1]).resolve(), sys.argv[2]
    cfg = Config()
    script = next(s for s in content._load_json("requests.json") + content._load_json("wow.json")
                  + content.load_bank() if s.topic == topic)
    from shorts import history as hist, qa, studio
    allowed, why = studio.can_publish(script.topic, hist.used_topics(cfg.history_file))
    if not allowed:
        sys.exit(f"[upload] refused: {why}")
    report = qa.inspect(video)
    print(report.summary())
    if not report.passed:
        sys.exit("[upload] refused: the quality gate blocked this video")
    work = video.parent / "upload_work"
    work.mkdir(exist_ok=True)
    cover = None
    try:
        # the opening frame with the title on top (captions hidden behind the title area)
        clip = work / "first.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.3", "-i", str(video), "-t", "0.5",
                        "-vf", "delogo=x=120:y=1180:w=840:h=260", "-an", str(clip)], check=True)
        cover = cover_mod.make(clip, 0.1, script.title, work / "cover.jpg", cfg.font_name, cfg.font_dir)
    except Exception as exc:  # polish only
        print(f"[upload] cover skipped ({str(exc)[:200]})")
    video_id = upload.upload(cfg, script, video, cover)
    print(f"[upload] https://youtu.be/{video_id}")
    from shorts import history
    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    history.record(cfg.history_file, script.topic, script.title, video_id,
                   journal=cfg.output_dir / "published.jsonl")


if __name__ == "__main__":
    main()
