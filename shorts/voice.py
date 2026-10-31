"""Narration: the whole script is read in one take (natural flow), and the
voice service reports when each word is spoken so captions match exactly."""
import asyncio
import os
from dataclasses import dataclass
from pathlib import Path

from .media import run

TICKS = 10_000_000  # edge-tts offsets are in 100-nanosecond units
RATE = "+0%"         # natural storytelling pace for the Gulf-dialect scripts
PITCH = "-3Hz"       # slightly deeper, warm narrator tone


@dataclass
class Segment:
    text: str
    start: float
    end: float


@dataclass
class Narration:
    audio: Path
    words: list[Segment]      # every spoken word with its timing
    line_sizes: list[int]     # how many words each script line has
    silent: bool              # True when TTS was unavailable (never upload these)

    @property
    def length(self) -> float:
        return self.words[-1].end + 1.2 if self.words else 0.0   # a calm beat after the last word


def join_lines(lines: list[str]) -> str:
    """One text for one natural read; every line ends like a sentence."""
    parts = []
    for line in lines:
        line = line.strip()
        parts.append(line if line[-1:] in ".!?؟،," else line + ".")
    return " ".join(parts)


def _spoken_words(line: str) -> list[str]:
    return [w for w in line.split() if any(ch.isalnum() for ch in w)]


async def _tts(text: str, voice: str, out: Path) -> list[Segment]:
    import edge_tts

    words: list[Segment] = []
    comm = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    with open(out, "wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / TICKS
                words.append(Segment(chunk["text"], start, start + chunk["duration"] / TICKS))
    return words


def _estimate(lines: list[str]) -> list[Segment]:
    """Fallback timing (~0.38s per word) used only with silent placeholder audio."""
    words, t = [], 0.0
    for line in lines:
        for w in _spoken_words(line):
            d = 0.2 + 0.035 * len(w)
            words.append(Segment(w, t, t + d))
            t += d + 0.04
        t += 0.25
    return words


def synthesize(lines: list[str], voice: str, workdir: Path) -> Narration:
    workdir.mkdir(parents=True, exist_ok=True)
    line_sizes = [len(_spoken_words(line)) for line in lines]
    raw = workdir / "voice.mp3"
    silent = False
    words = None
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        # natural human voice first; the free voice below is the fallback
        try:
            from . import eleven
            timed = eleven.synthesize(join_lines(lines), raw, key)
            if timed and raw.stat().st_size > 0:
                words = [Segment(t, a, b) for t, a, b in timed]
                print("[voice] ElevenLabs natural voice")
        except Exception as exc:
            print(f"[voice] ElevenLabs failed ({type(exc).__name__}: {str(exc)[:200]}); using the free voice")
    try:
        if words is None:
            words = asyncio.run(_tts(join_lines(lines), voice, raw))
        if not words or raw.stat().st_size == 0:
            raise RuntimeError("empty audio")
    except Exception as exc:  # network blocked, service down...
        print(f"[voice] TTS unavailable ({type(exc).__name__}); using silent placeholder")
        silent = True
        words = _estimate(lines)
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
             "-t", f"{words[-1].end + 0.4:.2f}", "-c:a", "libmp3lame", str(raw)])

    audio = workdir / "voice.m4a"
    run(["ffmpeg", "-y", "-i", str(raw), "-ar", "44100", "-ac", "2",
         "-c:a", "aac", "-b:a", "160k", str(audio)])
    return Narration(audio, words, line_sizes, silent)
