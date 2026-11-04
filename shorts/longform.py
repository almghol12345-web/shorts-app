"""Long horizontal videos (8-12 minutes) for watch hours: the channel's best stories (or
amazing facts) told back to back, with chapters, a thumbnail and the same voice and art.

Shorts bring viewers; these videos earn the 4,000 watch hours the Partner Program needs.
"""
import json
import os
import shutil
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from . import background, content, render, voice
from .config import ROOT, Config
from .content import Script
from .spoken import plain

WIDTH, HEIGHT = 1920, 1080
LONG_HISTORY = ROOT / "data" / "long_history.json"
ORDINALS = ["الأُولَى", "الثَّانْيَة", "الثَّالْثَة", "الرَّابْعَة", "الخَامْسَة", "السَّادْسَة",
            "السَّابْعَة", "الثَّامْنَة", "التَّاسْعَة", "العَاشْرَة", "رَقَم إِحْدَعْش", "رَقَم ثِنَعْش",
            "رَقَم ثَلَطَعْش", "رَقَم أَرْبَعْطَعْش", "رَقَم خَمْسَطَعْش"]
PLAIN_ORDINALS = [plain(o) for o in ORDINALS]

THEMES = {
    "mystery": {
        "title": "{n} قصص حقيقية غامضة.. ما لها تفسير لين اليوم 😳",
        "intro": ["{n} قِصَص حَقِيقِيَّة.. صَارَت فِعْلًا.. وْالعُلَمَاء لِين اليُوم مُحْتَارِين فِيهَا",
                  "وْالقِصَّة الأَخِيرَة.. أَغْرَبْهُم كُلْهُم"],
        "outro": ["هَذِي كَانَت {n} قِصَص.. وِش أَغْرَب وَحْدَة فِيهُم بِالنِّسْبَة لَك؟",
                  "اكْتِب لِي فِي التَّعْلِيقَات.. وْلَا تِنْسَى تِشْتِرِك عَشَان تُوصْلَك القِصَص الجَايَّة"],
        "tags": ["قصص غامضة", "قصص حقيقية", "ألغاز لم تحل", "قصص رعب حقيقية", "غموض", "أغرب القصص",
                 "اختفاء غامض", "قصص بالسعودي"],
        "hashtags": ["قصص_غامضة", "ألغاز", "قصص_حقيقية"],
    },
    "news": {
        "title": "{n} اكتشافات علمية بتبهرك 🤯 | معلومات ما كنت تعرفها",
        "intro": ["{n} اكتِشَافَات وْاخْتِرَاعَات حَقِيقِيَّة.. تِحِس إِنْهَا خَيَال", "وْالأَخِيرَة.. أَقْوَاهُم"],
        "outro": ["هَذِي كَانَت {n} مَعْلُومَات.. أَي وَحْدَة بَهَرَتْك أَكْثَر؟",
                  "اكْتِب لِي فِي التَّعْلِيقَات.. وْاشْتِرِك عَشَان تُوصْلَك المَعْلُومَات الجَايَّة"],
        "tags": ["اكتشافات علمية", "معلومات", "هل تعلم", "علوم", "فضاء", "تقنية", "اختراعات", "معلومات مدهشة"],
        "hashtags": ["معلومات", "اكتشافات", "علوم"],
    },
}


def _numbers(n: int) -> str:
    return {5: "خَمْس", 6: "سِت", 7: "سَبْع", 8: "ثَمَان", 9: "تِسْع", 10: "عَشْر", 11: "إِحْدَعْش",
            12: "ثِنَعْش", 13: "ثَلَطَعْش", 14: "أَرْبَعْطَعْش", 15: "خَمْسَطَعْش"}.get(n, str(n))


TARGET_MINUTES = 10.5   # at least 10 minutes (owner's choice); 8+ lets YouTube place mid-roll ads


def estimate_seconds(lines: list[str]) -> float:
    """Spoken length of lines in the channel voice (measured: ~0.42 s per word + a breath per line)."""
    words = sum(len(l.split()) for l in lines)
    return words * 0.42 + len(lines) * 0.25


def choose(kind: str, history: list[dict], stats: dict, done: set[str], count: int = 0) -> list[Script]:
    """The best-performing published stories of this kind (not used in a long video yet),
    topped up with unpublished ones, until the video reaches TARGET_MINUTES (or `count`
    stories when given). The strongest goes last, as the promised finale."""
    bank = {s.topic: s for s in content._load_json("wow.json" if kind == "news" else "mysteries.json")}
    views = {h["topic"]: stats.get(h.get("video_id") or "", {}).get("views", 0) for h in history}
    # full-length stories first (they carry the watch time), each group by views
    ranked = sorted((t for t in bank if t in views and t not in done),
                    key=lambda t: (len(bank[t].lines) >= 12, views[t]), reverse=True)
    unseen = sorted((s for t, s in bank.items() if t not in views and t not in done),
                    key=lambda s: len(s.lines) >= 12, reverse=True)
    pool = [bank[t] for t in ranked] + unseen
    picked, seconds = [], 25.0                      # intro, outro and chapter cards
    for s in pool:
        if count and len(picked) >= count:
            break
        if not count and (seconds >= TARGET_MINUTES * 60 or len(picked) >= len(ORDINALS)):
            break
        picked.append(s)
        seconds += estimate_seconds(s.lines) + 2.5
    print(f"[long] {len(picked)} stories, about {seconds / 60:.1f} min")
    return sorted(picked, key=lambda s: views.get(s.topic, 0))      # weakest first, best last


def assemble(kind: str, stories: list[Script]) -> tuple[Script, list[int]]:
    """One long script; returns it and the line index where each story starts (chapters)."""
    theme, n = THEMES[kind], len(stories)
    lines = [l.format(n=_numbers(n)) for l in theme["intro"]]
    scenes = [stories[-1].scenes[0] if stories[-1].scenes else "mysterious dark landscape"] * len(lines)
    visuals = [stories[-1].visuals[0] if stories[-1].visuals else "dark fog night"] * len(lines)
    starts = []
    for i, s in enumerate(stories):
        starts.append(len(lines))
        word = "القِصَّة" if kind == "mystery" else "المَعْلُومَة"
        lines.append(f"{word} {ORDINALS[i]}" if i < n - 1 else f"وْالأَخِيرَة.. {word} {ORDINALS[i]}")
        sc = s.scenes or [s.title] * len(s.lines)
        vi = s.visuals if len(s.visuals) == len(s.lines) else [(s.search_terms or ["dark fog night"])[0]] * len(s.lines)
        scenes.append(sc[0])
        visuals.append(vi[0])
        lines += s.lines
        scenes += sc
        visuals += vi
    outro = [l.format(n=_numbers(n)) for l in theme["outro"]]
    lines += outro
    scenes += [scenes[-1]] * len(outro)
    visuals += [visuals[-1]] * len(outro)
    if n > 10:   # Arabic: 3-10 take a plural noun, 11+ a singular one
        lines = [l.replace("قِصَص", "قِصَّة").replace("اكتِشَافَات وْاخْتِرَاعَات", "اكتِشَاف وْاخْتِرَاع") for l in lines]
        outro = [l.replace("قِصَص", "قِصَّة").replace("مَعْلُومَات", "مَعْلُومَة") for l in outro]
        theme = dict(theme, title=theme["title"].replace("قصص", "قصة").replace("اكتشافات", "اكتشاف"))
    title = theme["title"].format(n=str(len(stories)).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")))
    script = Script(topic=f"long:{kind}:{'+'.join(s.topic for s in stories)}", title=title, lines=lines,
                    description="", tags=theme["tags"], visuals=visuals, scenes=scenes, kind=kind)
    return script, starts


def chapters(starts: list[int], stories: list[Script], spans: list[float], kind: str) -> str:
    t = [sum(spans[:i]) for i in range(len(spans))]
    out = ["0:00 البداية"]
    for i, (k, s) in enumerate(zip(starts, stories)):
        sec = int(t[k])
        label = plain(s.title).replace("#shorts", "").strip(" .")
        out.append(f"{sec // 60}:{sec % 60:02d} {PLAIN_ORDINALS[i]}: {label}")
    return "\n".join(out)


def thumbnail(scene: str, text: str, workdir: Path, cfg: Config) -> Path | None:
    """A bold 16:9 thumbnail: the finale's scene and a big two-colour headline."""
    from . import replicate
    from .media import run
    art = workdir / "thumb_art.jpg"
    try:
        if not replicate.token():
            return None
        replicate.image(f"{scene}, dramatic, high contrast, cinematic, {background.ART_STYLE}", art, "16:9")
    except Exception as exc:
        print(f"[long] thumbnail art failed: {str(exc)[:150]}")
        return None
    words = text.split()
    top, bottom = " ".join(words[:len(words) // 2 + 1]), " ".join(words[len(words) // 2 + 1:])
    ass = workdir / "thumb.ass"
    ass.write_text(f"""[Script Info]
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Top,{cfg.font_name},128,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,9,4,8,40,40,40,1
Style: Bottom,{cfg.font_name},140,&H0000E1FF,&H0000E1FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,10,4,2,40,40,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Top,,0,0,0,,{top}
Dialogue: 0,0:00:00.00,0:00:05.00,Bottom,,0,0,0,,{bottom}
""", encoding="utf-8")
    out = workdir / "thumbnail.jpg"
    run(["ffmpeg", "-y", "-i", str(art), "-vf",
         f"scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=contrast=1.15:saturation=1.2,"
         f"vignette=PI/4,subtitles={ass.name}:fontsdir={cfg.font_dir.resolve()}",
         "-frames:v", "1", "-q:v", "3", str(out)], cwd=workdir)
    return out


def make_long(cfg: Config, kind: str, do_upload: bool, count: int = 0) -> dict:
    from . import history, learn
    from .pipeline import line_spans
    hist = history.load(cfg.history_file)
    done_topics = set()
    if LONG_HISTORY.exists():
        for item in json.loads(LONG_HISTORY.read_text(encoding="utf-8")):
            done_topics.update(item.get("stories", []))
    try:
        stats = learn.fetch_views(cfg) if cfg.can_upload else {}
    except Exception as exc:
        print(f"[long] stats unavailable: {exc}")
        stats = {}
    stories = choose(kind, hist, stats, done_topics, count)
    if len(stories) < 4:
        raise RuntimeError("not enough stories for a long video")
    script, starts = assemble(kind, stories)
    print(f"[long] {script.title}: " + " | ".join(s.topic for s in stories))

    wide = replace(cfg, width=WIDTH, height=HEIGHT)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    work = cfg.output_dir / "work" / f"long-{stamp}"
    work.mkdir(parents=True, exist_ok=True)
    narration = voice.synthesize(script.lines, cfg.voice, work / "voice")
    print(f"[long] voice {narration.length / 60:.1f} min")
    spans = line_spans(narration, len(script.lines))
    if not os.environ.get("REPLICATE_VIDEO_SHOTS"):
        # real motion on every third shot (AI-animated scene or real NASA footage); the
        # shots between are illustrations with camera moves. About a dollar per video.
        os.environ["REPLICATE_VIDEO_SHOTS"] = "every:3"
    bg, credits = background.build(script.visual_plan(), spans, work / "bg", WIDTH, HEIGHT,
                                   pexels_key=cfg.pexels_key, pixabay_key=cfg.pixabay_key)
    from .music import mood_for
    mood = "space" if kind == "news" else mood_for(" ".join(s.title for s in stories))
    t = [sum(spans[:i]) for i in range(len(spans))]
    cards = [(t[k], t[k] + 2.8, ("القصة " if kind == "mystery" else "المعلومة ") + PLAIN_ORDINALS[i],
              plain(s.title).replace("#shorts", "").strip(" .!"))
             for i, (k, s) in enumerate(zip(starts, stories))]
    from . import mascot
    narrator = None
    if mascot.available():
        narrator = mascot.track(script.lines, spans, work / "narrator.mov", height=int(HEIGHT * 0.42))
    video = render.render(wide, narration, bg, work, cfg.output_dir / f"long-{stamp}.mp4", mood=mood,
                          narrator=narrator,
                          cuts=t[1:], booms=[t[k] for k in starts], cards=cards)
    print(f"[long] video {video}")
    finale = stories[-1]
    try:
        thumb = thumbnail(finale.scenes[0] if finale.scenes else finale.title,
                          plain(finale.title).replace("#shorts", "").strip(" .!"), work, cfg)
    except Exception as exc:   # a missing thumbnail must never cost the whole video
        print(f"[long] thumbnail failed: {str(exc)[:200]}")
        thumb = None
    if thumb:
        shutil.copy(thumb, cfg.output_dir / "long_thumbnail.jpg")

    theme = THEMES[kind]
    description = (plain(script.lines[0]) + "\n\n" + chapters(starts, stories, spans, kind) + "\n\n"
                   "اكتب لي في التعليقات: وش أغرب وحدة؟ 👇\nاشترك عشان توصلك الجاية 🔔\n\n"
                   + " ".join(f"#{h}" for h in theme["hashtags"]))
    if credits:
        description += "\n\nالصور:\n" + "\n".join(credits)
    video_id = None
    if do_upload and not narration.silent and cfg.can_upload:
        from .upload import upload_long
        video_id = upload_long(cfg, script.title, description, theme["tags"], video, thumb)
        print(f"[long] https://youtube.com/watch?v={video_id}")
        items = json.loads(LONG_HISTORY.read_text(encoding="utf-8")) if LONG_HISTORY.exists() else []
        items.append({"video_id": video_id, "kind": kind, "title": script.title,
                      "stories": [s.topic for s in stories],
                      "date": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        LONG_HISTORY.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.rmtree(work, ignore_errors=True)
    return {"title": script.title, "video": str(video), "video_id": video_id}
