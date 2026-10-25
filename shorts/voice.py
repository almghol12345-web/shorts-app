"""Narration: one audio clip per script line, so captions sync exactly."""
import asyncio
from dataclasses import dataclass
from pathlib import Path

from .media import duration, run

PAUSE = 0.12  # seconds of silence between lines


@dataclass
class Segment:
    text: str
    start: float
    end: float


@dataclass
class Narration:
    audio: Path
    segments: list[Segment]
    silent: bool  # True when TTS was unavailable (never upload these)

    @property
    def length(self) -> float:
        return self.segments[-1].end + 0.3 if self.segments else 0.0


async def _tts(text: str, voice: str, out: Path) -> None:
    import edge_tts
    await edge_tts.Communicate(text, voice, rate="+14%").save(str(out))


def _silence(seconds: float, out: Path) -> None:
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", f"{seconds:.2f}", "-c:a", "libmp3lame", str(out)])


def synthesize(lines: list[str], voice: str, workdir: Path) -> Narration:
    workdir.mkdir(parents=True, exist_ok=True)
    clips: list[Path] = []
    silent = False
    for i, line in enumerate(lines):
        clip = workdir / f"line_{i:02d}.mp3"
        try:
            asyncio.run(_tts(line, voice, clip))
            if not clip.exists() or clip.stat().st_size == 0:
                raise RuntimeError("empty audio")
        except Exception as exc:  # network blocked, service down...
            if not silent:
                print(f"[voice] TTS unavailable ({type(exc).__name__}); using silent placeholder")
            silent = True
            _silence(max(1.2, len(line.split()) * 0.42), clip)
        clips.append(clip)

    gap = workdir / "gap.mp3"
    _silence(PAUSE, gap)

    segments: list[Segment] = []
    concat_list = workdir / "concat.txt"
    t = 0.0
    entries = []
    for line, clip in zip(lines, clips):
        d = duration(clip)
        segments.append(Segment(line, t, t + d))
        t += d + PAUSE
        entries += [f"file '{clip.resolve()}'", f"file '{gap.resolve()}'"]
    concat_list.write_text("\n".join(entries), encoding="utf-8")

    audio = workdir / "voice.m4a"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-ar", "44100", "-ac", "2", "-c:a", "aac", "-b:a", "160k", str(audio)])
    return Narration(audio, segments, silent)
