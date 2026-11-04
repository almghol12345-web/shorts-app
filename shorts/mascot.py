"""The channel's narrator character on screen: reusable animated moves (made once with
scripts/mascot_clip.py, stored in assets/mascot/clips) cut together to follow the story:
a greeting or shock on the hook, talking and pointing through the story, surprise on the
reveal, and an open-handed question at the end."""
import random
import subprocess
from pathlib import Path

CLIPS = Path(__file__).resolve().parent.parent / "assets" / "mascot" / "clips"
KEY = "colorkey=0xFF00FF:0.32:0.08"
REVEAL = ("وش اللي صار", "والنهاية", "والمفاجأة", "والأغرب", "بس الغريب", "مستحيل", "تخيل")


def available() -> bool:
    """On screen only once the owner approved it (assets/mascot/APPROVED), or for a test run
    with SHORTS_NARRATOR=mascot."""
    import os
    if not (CLIPS.exists() and any(CLIPS.glob("talk*.mp4"))):
        return False
    flag = os.environ.get("SHORTS_NARRATOR", "").strip().lower()
    if flag == "off":
        return False
    return flag == "mascot" or (CLIPS.parent / "APPROVED").exists()


def _have(move: str) -> bool:
    return (CLIPS / f"{move}.mp4").exists()


def plan(lines: list[str], seed: int = 3) -> list[str]:
    """One move per line."""
    from .spoken import plain
    rnd = random.Random(seed)
    body = [m for m in ("talk", "excited", "point", "think", "talk") if _have(m)] or ["talk"]
    moves = []
    for i, line in enumerate(lines):
        text = plain(line)
        if i == 0:
            move = "surprised" if "!" in text else "greet"
        elif i == len(lines) - 1:
            move = "ask"
        elif any(k in text for k in REVEAL):
            move = rnd.choice(["surprised", "point"])
        elif "؟" in text or "?" in text:
            move = "think"
        else:
            move = body[(i + rnd.randint(0, 1)) % len(body)]
        moves.append(move if _have(move) else "talk")
    return moves


def track(lines: list[str], spans: list[float], out: Path, height: int) -> Path:
    """Transparent video of the character, one move per line, cut to the narration."""
    segs: list[list] = []
    for move, dur in zip(plan(lines), spans):
        if segs and segs[-1][0] == move:
            segs[-1][1] += dur                      # same move twice in a row: just keep going
        else:
            segs.append([move, dur])
    parts = []
    for start in range(0, len(segs), 16):           # long videos: build in chunks
        chunk = segs[start:start + 16]
        inputs, graph = [], []
        for k, (move, dur) in enumerate(chunk):
            inputs += ["-stream_loop", "-1", "-t", f"{dur:.3f}", "-i", str(CLIPS / f"{move}.mp4")]
            graph.append(f"[{k}:v]fps=30,scale=-2:{height}:flags=lanczos,{KEY},format=rgba,"
                         f"setsar=1,settb=AVTB[m{k}]")
        graph.append("".join(f"[m{k}]" for k in range(len(chunk))) + f"concat=n={len(chunk)}:v=1:a=0[v]")
        part = out.with_name(f"{out.stem}_{start // 16:02d}.mov")
        subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(graph),
                        "-map", "[v]", "-c:v", "png", str(part)], check=True)
        parts.append(part)
    if len(parts) == 1:
        parts[0].replace(out)
    else:
        listing = out.with_suffix(".txt")
        listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts), encoding="utf-8")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                        "-c", "copy", str(out)], check=True)
    return out
