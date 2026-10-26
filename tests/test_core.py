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


def test_pixabay_picks_hd_file(monkeypatch, tmp_path):
    from shorts import background

    class Resp:
        def raise_for_status(self): pass
        def json(self):
            return {"hits": [{"id": 1, "duration": 10, "videos": {
                "large": {"url": "L", "width": 1920, "height": 1080},
                "medium": {"url": "M", "width": 1280, "height": 720},
                "tiny": {"url": "T", "width": 640, "height": 360}}}]}

    got = []
    monkeypatch.setattr(background.requests, "get", lambda *a, **k: Resp())
    monkeypatch.setattr(background, "_download", lambda url, out: got.append(url))
    clips = background.fetch_pixabay(["sea"], "key", tmp_path, want=1)
    assert len(clips) == 1 and got == ["M"]


def test_fact_bank_is_well_formed_and_unique():
    bank = content.load_bank()
    topics = [s.topic for s in bank]
    assert len(bank) >= 50 and len(topics) == len(set(topics))
    for s in bank:
        assert s.title.endswith("#shorts") and len(s.title) <= 100
        assert 5 <= len(s.lines) <= 10 and s.search_terms
