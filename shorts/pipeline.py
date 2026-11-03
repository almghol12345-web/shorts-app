"""One full run: script -> voice -> background -> video -> (upload)."""
import re
import shutil
from datetime import datetime
from pathlib import Path

from . import animate, background, content, history, render, voice
from .captions import split_lines
from .config import Config


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "short"


# The story already told the viewer what happened; this closing line invites comments
# about a detail of the story, never about its outcome.
OUTRO = "وأنت لو كنت مكانهم.. وش كنت بتسوي؟ اكتب لي في التعليقات"


def add_outro(script: content.Script) -> None:
    n = len(script.lines)
    closing = script.question.strip() or OUTRO
    if script.lines and script.lines[-1] == closing:
        return
    script.lines = script.lines + [closing]
    if len(script.scenes) == n:
        script.scenes = script.scenes + [script.scenes[-1]]
    if len(script.visuals) == n:
        script.visuals = script.visuals + [script.visuals[-1]]


def line_spans(narration: voice.Narration, n_lines: int) -> list[float]:
    """Seconds each script line is on screen: from its first spoken word to the next line's."""
    total = narration.length
    lines = split_lines(narration.words, narration.line_sizes)
    if len(lines) != n_lines or not all(lines):
        return [total / n_lines] * n_lines
    starts = [0.0] + [line[0].start for line in lines[1:]]
    return [b - a for a, b in zip(starts, starts[1:] + [total])]


def _learn(cfg: Config) -> dict:
    """Which kinds of Shorts got the most views so far (empty when offline)."""
    if not cfg.can_upload:
        return {}
    from . import learn
    try:
        scripts = {s.topic: s for s in content.load_bank() + content._load_json("wow.json")}
        scores = learn.group_scores(history.load(cfg.history_file), learn.fetch_views(cfg), scripts)
        best = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:4]
        print("[learn] best groups: " + ", ".join(f"{g} ~{round(__import__('math').expm1(v))} views" for g, v in best))
        learn.save_report(cfg.output_dir / "performance.json", scores)
        return scores
    except Exception as exc:  # learning is a bonus; never block a Short on it
        print(f"[learn] skipped ({type(exc).__name__}: {str(exc)[:150]})")
        return {}


def make_one(cfg: Config, do_upload: bool, keep_work: bool = False) -> dict:
    used = history.used_topics(cfg.history_file)
    scores = _learn(cfg)
    script = content.generate(cfg, used, scores)
    add_outro(script)
    print(f"[script] {script.title}")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"{stamp}-{_slug(script.topic)}"
    work = cfg.output_dir / "work" / name
    work.mkdir(parents=True, exist_ok=True)

    narration = voice.synthesize(script.lines, cfg.voice, work / "voice")
    print(f"[voice] {narration.length:.1f}s{' (silent placeholder)' if narration.silent else ''}")

    bg, credits = background.build(script.visual_plan(), line_spans(narration, len(script.lines)),
                                   work / "bg", cfg.width, cfg.height,
                                   pexels_key=cfg.pexels_key, pixabay_key=cfg.pixabay_key)
    if credits:
        script.description += "\n\nالصور:\n" + "\n".join(credits)
    spans = line_spans(narration, len(script.lines))
    starts = [sum(spans[:i]) for i in range(len(spans))]
    narrator = None
    if cfg.show_narrator:
        narrator, _ = animate.character_track(narration.audio, starts, narration.length, work / "narrator.mov")
    from .music import mood_for
    mood = mood_for(script.title, " ".join(script.tags), " ".join(script.visual_plan()), " ".join(script.lines))
    print(f"[music] mood: {mood}")
    video = render.render(cfg, narration, bg, work, cfg.output_dir / f"{name}.mp4",
                          narrator=narrator, mood=mood)
    print(f"[video] {video}")
    mids = [starts[i] + spans[i] / 2 for i in range(len(spans))]
    render.contact_sheet(video, mids, cfg.output_dir / "preview.jpg")

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
            history.record(cfg.history_file, script.source or script.topic, script.title, video_id,
                           journal=cfg.output_dir / "published.jsonl")

    if not keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return {"title": script.title, "video": str(video), "video_id": video_id}
