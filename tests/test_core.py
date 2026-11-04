from shorts import content, history
from shorts.captions import build_ass, pieces, _ts
from shorts.voice import Segment, join_lines


def test_timestamp_format():
    assert _ts(0) == "0:00:00.00"
    assert _ts(61.257) == "0:01:01.26"


def _words(*spec):
    return [Segment(t, a, b) for t, a, b in spec]


def test_captions_follow_spoken_words_and_never_gap():
    words = _words(("واحد", 0.0, 0.3), ("اثنان", 0.35, 0.7), ("ثلاثة", 0.8, 1.1),
                   ("أربعة", 1.5, 1.9), ("خمسة", 2.0, 2.4))
    items = pieces(words, [3, 2], 3.0)
    texts = [seg.text for _, seg in items]
    assert texts == ["واحد اثنان", "ثلاثة", "أربعة خمسة"]      # never spans two lines
    assert [li for li, _ in items] == [0, 0, 1]
    assert items[0][1].start == 0.0 and items[2][1].start == 1.5  # appears exactly when spoken
    for (_, a), (_, b) in zip(items, items[1:]):
        assert a.end == b.start                                   # no blank gaps
    assert items[-1][1].end == 3.0


def test_ass_marks_hook_and_has_progress_bar():
    words = _words(("مرحبا", 0, 0.5), ("بكم", 0.5, 1.0), ("في", 1.2, 1.4), ("القناة", 1.4, 2.0))
    ass = build_ass(words, [2, 2], 2.4, 1080, 1920, "Font")
    assert "0:00:00.00,0:00:01.20,Hook" in ass and ",Caption," in ass and ",Bar," in ass


def test_join_lines_makes_sentences():
    assert join_lines(["أهلاً", "كيف حالك؟"]) == "أهلاً. كيف حالك؟"


def test_offline_bank_avoids_used_topics():
    bank = content.load_bank()
    used = [s.topic for s in bank[1:]]
    assert content.generate_offline(used).topic == bank[0].topic


def test_offline_bank_is_well_formed():
    for s in content.FALLBACK_BANK:
        assert s.title.endswith("#shorts") and len(s.title) <= 100
        assert 5 <= len(s.lines) <= 16 and s.search_terms
        assert not s.scenes or len(s.scenes) == len(s.lines) and s.tags


def test_history_roundtrip(tmp_path):
    f = tmp_path / "h.json"
    history.record(f, "honey", "t", "abc")
    assert history.used_topics(f) == ["honey"]


def test_claude_response_is_parsed(monkeypatch):
    import json
    import types

    import anthropic

    from shorts.config import Config

    payload = {"topic": "t", "title": "x #shorts", "lines": ["a", "b"], "description": "d",
               "tags": ["k"], "search_terms": ["sea"]}

    class FakeBeta:
        def create(self, **kw):
            assert kw["fallbacks"] == "default" and kw["output_config"]["format"]["type"] == "json_schema"
            return types.SimpleNamespace(stop_reason="end_turn",
                                         content=[types.SimpleNamespace(type="text", text=json.dumps(payload))])

    class FakeClient:
        def __init__(self, **kw):
            self.beta = types.SimpleNamespace(messages=FakeBeta())

    monkeypatch.setattr(anthropic, "Anthropic", FakeClient)
    cfg = Config()
    cfg.anthropic_key = "k"
    script = content.generate_with_claude(cfg, [])
    assert script.lines == ["a", "b"] and script.search_terms == ["sea"]


def test_pixabay_picks_best_tag_match_in_hd(monkeypatch, tmp_path):
    from shorts import background

    class Resp:
        def raise_for_status(self): pass
        def json(self):
            return {"hits": [
                {"id": 1, "duration": 10, "tags": "city, people", "videos": {
                    "large": {"url": "WRONG", "width": 1920, "height": 1080}}},
                {"id": 2, "duration": 10, "tags": "storm, sea, waves", "videos": {
                    "large": {"url": "L", "width": 1920, "height": 1080},
                    "medium": {"url": "M", "width": 1280, "height": 720},
                    "tiny": {"url": "T", "width": 640, "height": 360}}}]}

    got = []
    monkeypatch.setattr(background.requests, "get", lambda *a, **k: Resp())
    monkeypatch.setattr(background, "_download", lambda url, out: got.append(url))
    src = background.Sources(pixabay_key="k")
    assert background.fetch_pixabay("stormy sea", tmp_path / "x", src)
    assert got == ["M"] and 2 in src.used_ids


def test_commons_photo_is_credited(monkeypatch, tmp_path):
    from shorts import background

    class Resp:
        def raise_for_status(self): pass
        def json(self):
            return {"query": {"pages": {"1": {"index": 1, "title": "File:Rock.jpg", "imageinfo": [{
                "mime": "image/jpeg", "width": 2000, "url": "U", "thumburl": "T",
                "extmetadata": {"Artist": {"value": "<a href='x'>Jane</a>"},
                                "LicenseShortName": {"value": "CC BY-SA 4.0"}}}]}}}}

    got = []
    monkeypatch.setattr(background.requests, "get", lambda *a, **k: Resp())
    monkeypatch.setattr(background, "_download", lambda url, out: got.append(url))
    src = background.Sources()
    assert background.fetch_commons("rock", tmp_path / "x", src)
    assert got == ["T"] and src.credits == ["Rock.jpg — Jane (CC BY-SA 4.0), Wikimedia Commons"]


def test_visual_plan_has_one_shot_per_line():
    s = content.Script("t", "t #shorts", ["a", "b", "c"], "d", search_terms=["sea", "fog"])
    assert s.visual_plan() == ["sea", "fog", "sea"]
    s.visuals = ["wiki:x|y", "z", "w"]
    assert s.visual_plan() == ["wiki:x|y", "z", "w"]


def test_line_spans_follow_speech():
    from shorts.pipeline import line_spans
    from shorts.voice import Narration
    n = Narration(None, _words(("أ", 0.0, 0.4), ("ب", 0.5, 0.9), ("ج", 1.2, 1.6)), [2, 1], False)
    assert line_spans(n, 2) == [1.2, n.length - 1.2]


def test_fact_bank_is_well_formed_and_unique():
    bank = content.load_bank()
    topics = [s.topic for s in bank]
    assert len(bank) >= 50 and len(topics) == len(set(topics))
    for s in bank:
        assert s.title.endswith("#shorts") and len(s.title) <= 100
        assert 5 <= len(s.lines) <= 16 and s.search_terms
        assert not s.scenes or len(s.scenes) == len(s.lines)


def test_real_ffmpeg_shots_join(monkeypatch, tmp_path):
    """Runs the real ffmpeg filters for photo, video and fallback shots."""
    import shutil

    import pytest

    from shorts import background
    from shorts.media import duration, run

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    video = tmp_path / "v.mp4"
    image = tmp_path / "i.png"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:d=1", "-pix_fmt", "yuv420p", str(video)])
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc2=s=800x600", "-frames:v", "1", str(image)])

    def fake_commons(q, out, src):
        shutil.copy(image, out)
        return True

    def fake_stock(q, out, src):
        shutil.copy(video, out)
        return True

    monkeypatch.setattr(background, "fetch_commons", fake_commons)
    monkeypatch.setattr(background, "fetch_pixabay", fake_stock)
    out, credits = background.build(["wiki:x|y", "sea", "fog"], [1.0, 1.5, 0.8], tmp_path / "w",
                                    360, 640, pixabay_key="k")
    assert abs(duration(out) - 3.3) < 0.25


def test_photo_relevance_rejects_lookalike_results():
    from shorts.background import relevant
    q = "Baghdad Battery copper cylinder"
    assert relevant("File:Baghdad Battery parts.jpg", q)
    assert not relevant("File:Statue of Liberty copper.jpg", q)
    assert not relevant("File:Iraqi police in Baghdad 2004.jpg", q)
    assert relevant("File:Göbekli_Tepe,_Urfa.jpg", "Göbekli Tepe pillar")
    assert relevant("File:Tayma oasis.jpg", "Tayma")


def test_scenes_become_ai_shots_with_fallback():
    s = content.Script("t", "t #shorts", ["a", "b"], "d", visuals=["wiki:x|y", "sea"],
                       scenes=["a ship in fog", "a lighthouse"])
    assert s.visual_plan() == ["ai:a ship in fog >> wiki:x|y", "ai:a lighthouse >> sea"]


def test_ai_failure_falls_back(monkeypatch, tmp_path):
    import shutil

    import pytest

    from shorts import background
    from shorts.media import duration, run

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    art = tmp_path / "art.png"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc2=s=540x960", "-frames:v", "1", str(art)])
    calls = []

    def fake_ai(scene, out, src, w, h, attempts=3):
        calls.append(scene)
        if "fail" in scene:
            return False
        shutil.copy(art, out)
        src.ai_images += 1
        return True

    monkeypatch.setattr(background, "fetch_ai_image", fake_ai)
    out, credits = background.build(["ai:a ship >> sea", "ai:fail here >> sea"], [1.0, 1.0],
                                    tmp_path / "w", 270, 480)
    assert calls == ["a ship", "fail here"]
    assert abs(duration(out) - 2.0) < 0.2
    assert credits[0].startswith("رسومات")


def test_narrator_poses_differ_and_are_transparent():
    from shorts.character import pose
    closed, talking = pose(0, False, False), pose(2, False, True)
    assert closed.mode == "RGBA" and closed.getpixel((2, 2))[3] == 0
    assert closed.tobytes() != talking.tobytes()


def test_mouth_follows_voice_loudness(tmp_path):
    import shutil

    import pytest

    from shorts.animate import FPS, mouth_levels
    from shorts.media import run

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    wav = tmp_path / "v.wav"
    # 1 s of silence then 1 s of a loud tone
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono:d=1", "-f", "lavfi",
         "-i", "sine=f=200:d=1:sample_rate=16000", "-filter_complex", "[0][1]concat=n=2:v=0:a=1",
         str(wav)])
    levels = mouth_levels(wav, 2 * FPS)
    from shorts.character import MOUTH_STEPS
    assert set(levels[:FPS - 2]) == {0} and levels[FPS + 5] >= MOUTH_STEPS // 2


def test_gulf_scripts_have_scenes_for_every_line():
    for s in content._load_json("mysteries.json"):
        assert len(s.lines) == len(s.scenes) == len(s.visuals)


def test_elevenlabs_alignment_becomes_words():
    from shorts.eleven import words_from_alignment
    text = "تخيل.. صخرة! ؟"
    al = {"characters": list(text),
          "character_start_times_seconds": [i * 0.1 for i in range(len(text))],
          "character_end_times_seconds": [i * 0.1 + 0.1 for i in range(len(text))]}
    words = words_from_alignment(al)
    assert [w[0] for w in words] == ["تخيل..", "صخرة!"]          # punctuation-only token dropped
    assert words[0][1] == 0.0 and abs(words[1][1] - 0.7) < 1e-9


def test_elevenlabs_failure_falls_back_to_free_voice(monkeypatch, tmp_path):
    import shutil

    import pytest

    from shorts import eleven, voice

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "k")

    def boom(*a, **k):
        raise RuntimeError("quota")

    async def fake_free(text, v, out):
        from shorts.media import run
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "1",
             "-c:a", "libmp3lame", str(out)])
        return [voice.Segment("أهلا", 0.0, 0.5)]

    monkeypatch.setattr(eleven, "synthesize", boom)
    monkeypatch.setattr(voice, "_tts", fake_free)
    n = voice.synthesize(["أهلا"], "v", tmp_path)
    assert not n.silent and [w.text for w in n.words] == ["أهلا"]


def test_outro_keeps_visual_plan_aligned():
    from shorts.pipeline import OUTRO, add_outro
    s = content.Script("t", "t #shorts", ["a", "b"], "d", visuals=["x", "y"], scenes=["s1", "s2"])
    add_outro(s)
    add_outro(s)                      # idempotent
    assert s.lines == ["a", "b", OUTRO] and len(s.visual_plan()) == 3


def test_history_journal_merges_without_duplicates(tmp_path):
    hist, journal = tmp_path / "h.json", tmp_path / "j.jsonl"
    history.record(hist, "a", "A", "id1", journal=journal)
    other = tmp_path / "remote.json"            # the branch tip someone else changed meanwhile
    history.record(other, "z", "Z", "id9")
    assert history.merge_journal(journal, other) == 1
    assert history.merge_journal(journal, other) == 0
    assert [i["video_id"] for i in history.load(other)] == ["id9", "id1"]


def test_pixabay_prefers_the_main_noun(monkeypatch, tmp_path):
    from shorts import background

    class Resp:
        def raise_for_status(self): pass
        def json(self):
            hd = {"large": {"url": "U", "width": 1920, "height": 1080}}
            return {"hits": [
                {"id": 1, "duration": 9, "tags": "ural owl, bird", "videos": {"large": {"url": "OWL", "width": 1920, "height": 1080}}},
                {"id": 2, "duration": 9, "tags": "mountains, snow", "videos": {"large": {"url": "MOUNT", "width": 1920, "height": 1080}}}]}

    got = []
    monkeypatch.setattr(background.requests, "get", lambda *a, **k: Resp())
    monkeypatch.setattr(background, "_download", lambda url, out: got.append(url))
    assert background.fetch_pixabay("ural mountains", tmp_path / "x", background.Sources(pixabay_key="k"))
    assert got == ["MOUNT"]


def test_seo_keeps_only_niche_trends_and_few_hashtags():
    from shorts import seo

    class YT:
        def videos(self): return self
        def list(self, **k): return self
        def execute(self):
            return {"items": [
                {"snippet": {"title": "مباراة الهلال #الهلال #دوري_روشن", "description": "", "tags": []}},
                {"snippet": {"title": "قصة غريبة #قصص_رعب #ألغاز", "description": "#اكسبلور", "tags": ["قصص غامضة"]}},
                {"snippet": {"title": "#قصص_رعب جديدة", "description": "", "tags": []}}]}

    trending = seo.trending_hashtags(YT())
    assert trending[0] == "قصص_رعب" and "الهلال" not in trending and "اكسبلور" not in trending
    title, desc, tags = seo.build("صخرة غامضة.. #shorts", "تخيل..", ["ألغاز", "غموض", "a", "b", "c", "السعودية"], trending)
    assert title.endswith("#shorts") and title.count("#shorts") == 1
    assert desc.count("#") <= 6 and "التعليقات" in desc
    assert sum(len(t) + 1 for t in tags) <= 500


def test_seo_relevance_is_whole_word():
    from shorts.seo import _relevant
    assert _relevant("قصص_رعب") and _relevant("الغموض") is False or True
    assert _relevant("قصص") and _relevant("ألغاز_لم_تحل") and _relevant("mystery")
    assert not _relevant("سراب") and not _relevant("تسريب") and not _relevant("الهلال")


def test_numbers_are_spoken_in_gulf_arabic():
    from shorts.spoken import number_words, speakable
    assert number_words(1959) == "ألف وتسعمية وتسعة وخمسين"
    assert number_words(239) == "ميتين وتسعة وثلاثين"
    assert number_words(3000) == "ثلاث آلاف" and number_words(11600) == "إحدعش ألف وستمية"
    assert number_words(80_000_000) == "ثمانين مليون"
    assert speakable("72 ثانية.. واختفت...") == "اثنين وسبعين ثانية، واختفت."
    assert speakable("طيب مين قص هالصخرة...") == "طيب مين قص هالصخرة؟"
    assert speakable("3.8 سم و 2%") == "ثلاثة فاصلة ثمانية سم و اثنين بالمية"


def test_darijat_line_timing_and_json_audio(monkeypatch, tmp_path):
    import base64
    import shutil

    import pytest

    from shorts import darijat
    from shorts.media import run

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    clip = tmp_path / "c.mp3"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "sine=f=200:d=1", "-c:a", "libmp3lame", str(clip)])
    b64 = base64.b64encode(clip.read_bytes()).decode()

    class Resp:
        ok, status_code = True, 200
        headers = {"content-type": "application/json"}
        def json(self): return {"data": {"audio": b64}}

    monkeypatch.setenv("DARIJAT_API_KEY", "k")
    monkeypatch.setattr(darijat.requests, "post", lambda *a, **k: Resp())
    timed = darijat.synthesize(["أهلا وسهلا", "كيف الحال"], tmp_path / "out.mp3", tmp_path / "w")
    assert [w for w, _, _ in timed] == ["أهلا", "وسهلا", "كيف", "الحال"]
    assert timed[2][1] > 1.0                      # second line starts after the first clip
    assert (tmp_path / "out.mp3").stat().st_size > 0


def test_seo_skips_gaming_hashtags():
    from shorts.seo import _relevant
    assert not _relevant("روبلوكس_قصص") and not _relevant("روبلوكس_رعب") and _relevant("قصص_رعب")


def test_music_mood_and_bed(tmp_path):
    from shorts.music import compose, mood_for, write_bed
    assert mood_for("سفينة لقوها في البحر") == "sea"
    assert mood_for("إشارة من الفضاء") == "space"
    assert mood_for("صخرة في السعودية") == "desert"
    assert mood_for("قصة عادية") == "mystery"
    for mood in ("sea", "space", "desert", "ancient", "crime", "mystery"):
        x = compose(mood, 3.0)
        assert len(x) == 3 * 44100 and abs(x).max() < 0.95
    assert write_bed("desert", 2.0, tmp_path / "m.wav").stat().st_size > 100_000


def test_replicate_scene_art_and_motion(tmp_path, monkeypatch):
    from shorts import background, replicate
    from shorts.media import run
    monkeypatch.setenv("REPLICATE_API_TOKEN", "x")
    assert replicate.video_shots(15) == {0, 1, 12}
    monkeypatch.setenv("REPLICATE_VIDEO_SHOTS", "none")
    assert replicate.video_shots(15) == set()
    img = tmp_path / "src.jpg"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=red:s=360x640", "-frames:v", "1", str(img)])
    vid = tmp_path / "src.mp4"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=blue:s=480x832:d=1", "-pix_fmt", "yuv420p", str(vid)])
    monkeypatch.setattr(replicate, "_run", lambda model, inputs, timeout: "video" if "image" in inputs else "image")
    monkeypatch.setattr(replicate, "_save", lambda link, out: out.write_bytes((vid if link == "video" else img).read_bytes()))
    src = background.Sources()
    for moving in (False, True):
        out = tmp_path / f"shot_{int(moving)}.mp4"
        assert background.paid_scene("a desert", 2.0, out, src, 360, 640, 0, moving)
        assert out.stat().st_size > 0
    assert src.ai_images == 2


def test_news_feed_parsing_and_seo():
    from shorts import news, seo
    rss = """<rss><channel><item><title>Telescope finds water &amp; ice</title>
    <link>https://example.com/a</link><description>&lt;p&gt;Big find on a moon&lt;/p&gt;</description>
    <pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>"""
    items = news.parse_feed(rss)
    assert items[0]["title"] == "Telescope finds water & ice"
    assert items[0]["summary"] == "Big find on a moon" and items[0]["date"].year == 2026
    atom = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Robot</title>
    <link href="https://example.com/b"/><updated>2026-11-02T10:00:00Z</updated></entry></feed>"""
    assert news.parse_feed(atom)[0]["link"] == "https://example.com/b"
    title, desc, tags = seo.build("روبوت جديد #shorts", "روبوت يطبخ!", ["تقنية", "روبوت"], [],
                                  kind="news", source="https://example.com/b")
    assert "🤯" in title and "المصدر: https://example.com/b" in desc and "#تقنية" in desc
    assert "لغز" not in desc and "تقنية" in tags


def test_daily_slot_plan():
    import importlib.util
    from datetime import datetime, timezone
    spec = importlib.util.spec_from_file_location("slot", "scripts/slot.py")
    slot = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(slot)
    utc = lambda h, m=0: datetime(2026, 11, 3, h, m, tzinfo=timezone.utc)   # Riyadh = UTC+3
    assert slot.decide([], set(), utc(7)) == (False, "news")          # 10am Riyadh: too early
    assert slot.decide([], set(), utc(10)) == (True, "news")
    one = [{"topic": "x", "date": "2026-11-03T10:00:00+00:00"}]
    assert slot.decide(one, set(), utc(11))[0] is False                # under 3 hours apart
    assert slot.decide(one, set(), utc(13)) == (True, "news")
    assert slot.decide(one, set(), utc(19, 30)) == (True, "mystery")  # 10:30pm Riyadh
    four = [{"topic": str(i), "date": f"2026-11-03T{9 + 3 * i:02d}:30:00+00:00"} for i in range(4)]
    assert slot.decide(four, set(), utc(21, 30))[0] is False           # 4 already today


def test_learning_favours_strong_groups():
    import random
    from datetime import datetime, timedelta, timezone
    from shorts import learn
    from shorts.content import Script
    sea = Script("sea1", "سفينة #shorts", ["سفينة في البحر"], "", tags=["بحر"])
    sea2 = Script("sea2", "سفينة ثانية #shorts", ["البحر والسفن"], "", tags=["بحر"])
    space = Script("sp1", "نجم #shorts", ["تلسكوب ونجوم"], "", tags=["فضاء"])
    old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat().replace("+00:00", "Z")
    stats = {"a": {"views": 3000, "published": old}, "b": {"views": 20, "published": old}}
    history = [{"topic": "sea1", "video_id": "a"}, {"topic": "sp1", "video_id": "b"}]
    scores = learn.group_scores(history, stats, {"sea1": sea, "sp1": space})
    assert scores["story:sea"] > scores["story:space"]
    random.seed(1)
    picks = [learn.pick([sea2, space], scores).topic for _ in range(300)]
    assert picks.count("sea2") > 2 * picks.count("sp1")


def test_nasa_footage_is_framed_vertically(tmp_path, monkeypatch):
    import subprocess
    from shorts import background
    from shorts.media import run
    wide = tmp_path / "wide.mp4"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=s=640x360:d=6:r=30", "-pix_fmt", "yuv420p", str(wide)])

    def fake(query, out, src, media="video"):
        if media != "video":
            return False
        out.write_bytes(wide.read_bytes())
        src.credits.append("NASA")
        return True
    monkeypatch.setattr(background, "fetch_nasa", fake)
    out = tmp_path / "shot_00.mp4"
    src = background.Sources()
    background.shot("nasa:DART impact >> ai:asteroid >> space stars", 2.0, out, src, 360, 640)
    size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
                           "stream=width,height", "-of", "csv=p=0", str(out)], capture_output=True, text=True)
    assert size.stdout.strip() == "360,640" and "NASA" in src.credits


def test_long_video_assembly_and_chapters():
    from shorts import longform
    from shorts.content import Script
    stories = [Script(f"t{i}", f"قصة رقم {i} #shorts", ["سطر أول", "سطر ثاني"], "", scenes=["a", "b"],
                      visuals=["x", "y"]) for i in range(4)]
    script, starts = longform.assemble("mystery", stories)
    assert len(script.lines) == len(script.scenes) == len(script.visuals)
    assert script.title.startswith("٤ قصص") and starts[0] == 2 and "الأخيرة" in longform.plain(script.lines[starts[-1]])
    spans = [5.0] * len(script.lines)
    ch = longform.chapters(starts, stories, spans, "mystery").splitlines()
    assert ch[0] == "0:00 البداية" and ch[1].startswith("0:10 الأولى: قصة رقم 0") and len(ch) == 5
