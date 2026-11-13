"""The production board: where every planned video is in the pipeline, kept in the repository
so it survives between sessions. A video moves one stage at a time; each move records who did
it and the evidence. Publishing is refused in code unless the board says "approved".

    idea -> script -> fact_check -> storyboard -> render -> qa -> approved -> (published)

"published" is never written here: it is read from the publication history, so a video cannot
be marked published without really being on the channel, and cannot be published twice.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

STAGES = ["idea", "script", "fact_check", "storyboard", "render", "qa", "approved"]
MAX_REWORKS = 4            # after this many send-backs the video is blocked for a human decision
ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "data" / "studio" / "board.json"
LOG = ROOT / "data" / "studio" / "log.jsonl"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load(path: Path = BOARD) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _save(board: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(board, ensure_ascii=False, indent=1), encoding="utf-8")


def _log(path: Path, **event) -> None:
    log = path.with_name("log.jsonl")
    with open(log, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"at": _now(), **event}, ensure_ascii=False) + "\n")


def add(topic: str, by: str, note: str = "", path: Path = BOARD) -> dict:
    board = load(path)
    if topic in board:
        raise ValueError(f"'{topic}' is already on the board")
    board[topic] = {"stage": "idea", "reworks": 0, "blocked": False, "updated": _now(),
                    "evidence": {"idea": {"by": by, "note": note, "at": _now()}}}
    _save(board, path)
    _log(path, topic=topic, event="added", by=by, note=note)
    return board[topic]


def advance(topic: str, stage: str, by: str, evidence: str, path: Path = BOARD) -> dict:
    """Move a video to the next stage. Stages cannot be skipped and evidence is required."""
    board = load(path)
    item = board.get(topic)
    if item is None:
        raise ValueError(f"'{topic}' is not on the board")
    if item["blocked"]:
        raise ValueError(f"'{topic}' is blocked after {item['reworks']} reworks; a person must decide")
    if stage not in STAGES:
        raise ValueError(f"unknown stage '{stage}'")
    if not evidence.strip():
        raise ValueError("evidence is required (what was checked, or the file/run that proves it)")
    if STAGES.index(stage) != STAGES.index(item["stage"]) + 1:
        raise ValueError(f"'{topic}' is at '{item['stage']}'; the next stage is "
                         f"'{STAGES[min(STAGES.index(item['stage']) + 1, len(STAGES) - 1)]}', not '{stage}'")
    item["stage"], item["updated"] = stage, _now()
    item["evidence"][stage] = {"by": by, "note": evidence, "at": _now()}
    _save(board, path)
    _log(path, topic=topic, event="advance", stage=stage, by=by, note=evidence)
    return item


def rework(topic: str, back_to: str, by: str, reason: str, path: Path = BOARD) -> dict:
    """Send a video back to an earlier stage. Too many send-backs block it (no endless loops)."""
    board = load(path)
    item = board.get(topic)
    if item is None:
        raise ValueError(f"'{topic}' is not on the board")
    if back_to not in STAGES or STAGES.index(back_to) >= STAGES.index(item["stage"]):
        raise ValueError(f"'{back_to}' is not an earlier stage than '{item['stage']}'")
    item["reworks"] += 1
    item["stage"], item["updated"] = back_to, _now()
    for later in STAGES[STAGES.index(back_to) + 1:]:
        item["evidence"].pop(later, None)       # later sign-offs no longer hold
    item["blocked"] = item["reworks"] > MAX_REWORKS
    _save(board, path)
    _log(path, topic=topic, event="rework", stage=back_to, by=by, note=reason, blocked=item["blocked"])
    return item


def status(topic: str, published: list[str], path: Path = BOARD) -> str:
    if topic in published:
        return "published"
    item = load(path).get(topic)
    return "untracked" if item is None else "blocked" if item["blocked"] else item["stage"]


def can_publish(topic: str, published: list[str], path: Path = BOARD) -> tuple[bool, str]:
    """The publishing rule, enforced by the pipeline before any upload."""
    state = status(topic, published, path)
    if state == "published":
        return False, f"'{topic}' is already published"
    if state == "untracked":
        return True, "not on the board (older stock): allowed"
    if state == "approved":
        return True, "approved on the board"
    return False, f"'{topic}' is at stage '{state}', not approved"


def next_ready(published: list[str], path: Path = BOARD) -> str | None:
    """The oldest approved video that is not on the channel yet."""
    ready = [(item["evidence"]["approved"]["at"], order, topic)
             for order, (topic, item) in enumerate(load(path).items())
             if item["stage"] == "approved" and not item["blocked"] and topic not in published]
    return min(ready)[2] if ready else None
