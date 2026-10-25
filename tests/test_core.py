from shorts import content, history
from shorts.captions import build_ass, chunk, _ts
from shorts.voice import Segment


def test_timestamp_format():
    assert _ts(0) == "0:00:00.00"
    assert _ts(61.257) == "0:01:01.26"


def test_chunk_covers_segment_exactly():
    seg = Segment("واحد اثنان ثلاثة أربعة خمسة ستة سبعة", 2.0, 6.0)
    pieces = chunk(seg)
    assert len(pieces) == 3
    assert pieces[0].start == 2.0 and pieces[-1].end == 6.0
    for a, b in zip(pieces, pieces[1:]):
        assert abs(a.end - b.start) < 1e-9


def test_ass_has_no_gaps_between_lines():
    segs = [Segment("مرحبا بكم", 0, 1.0), Segment("في القناة", 1.25, 2.0)]
    ass = build_ass(segs, 2.6, 1080, 1920, "Font")
    assert "0:00:00.00,0:00:01.25,Hook" in ass   # first line held through the pause
    assert "Bar" in ass and "{" not in "".join(s.text for s in segs)


def test_offline_bank_avoids_used_topics():
    used = [s.topic for s in content.FALLBACK_BANK[1:]]
    assert content.generate_offline(used).topic == content.FALLBACK_BANK[0].topic


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
