"""Post the channel's question comment on published Shorts: python scripts/post_comment.py <ids>"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts.config import Config  # noqa: E402
from shorts.spoken import plain  # noqa: E402
from shorts.upload import _client, post_comment  # noqa: E402


def main() -> None:
    yt = _client(Config())
    history = {h["video_id"]: h["topic"] for h in json.loads((ROOT / "data/history.json").read_text(encoding="utf-8"))}
    bank = {}
    for name in ("mysteries.json", "facts.json", "wow.json"):
        path = ROOT / "data" / name
        if path.exists():
            bank.update({s["topic"]: s for s in json.loads(path.read_text(encoding="utf-8"))})
    ok = True
    for vid in [v.strip() for v in sys.argv[1].split(",") if v.strip()]:
        s = bank.get(history.get(vid, ""))
        text = plain(s.get("question") or "") if s else ""
        text = text or "وش رأيك أنت؟ اكتب لي في التعليقات"
        ok &= post_comment(yt, vid, text + " 👇")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
