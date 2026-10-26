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
        assert 5 <= len(s.lines) <= 10 and s.search_terms and s.tags


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
    script = content.generate(cfg, [])
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
        assert 5 <= len(s.lines) <= 10 and s.search_terms


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
