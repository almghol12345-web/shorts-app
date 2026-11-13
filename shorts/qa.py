"""Automatic quality gate: measures the finished video with ffprobe/ffmpeg and decides
whether it may be published. Every finding comes from a measurement, never a guess.

A video is published only when no critical finding exists and the score is at least PASS_SCORE.
"""
import json
import re
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path

PASS_SCORE = 95
CRITICAL, MAJOR, MINOR = "critical", "major", "minor"
COST = {CRITICAL: 100, MAJOR: 10, MINOR: 3}


@dataclass
class Finding:
    level: str
    check: str
    detail: str


@dataclass
class Report:
    video: str
    facts: dict = field(default_factory=dict)       # what was measured
    findings: list[Finding] = field(default_factory=list)

    def add(self, level: str, check: str, detail: str) -> None:
        self.findings.append(Finding(level, check, detail))

    @property
    def score(self) -> int:
        return max(0, 100 - sum(COST[f.level] for f in self.findings))

    @property
    def passed(self) -> bool:
        return self.score >= PASS_SCORE and not any(f.level == CRITICAL for f in self.findings)

    def to_dict(self) -> dict:
        return {"video": self.video, "score": self.score, "passed": self.passed, "facts": self.facts,
                "findings": [asdict(f) for f in self.findings]}

    def summary(self) -> str:
        lines = [f"[qa] score {self.score}/100 -> {'PASS' if self.passed else 'BLOCKED'}"]
        lines += [f"[qa] {f.level}: {f.check}: {f.detail}" for f in self.findings]
        return "\n".join(lines)


def _fps(rate: str) -> float:
    num, _, den = (rate or "0/1").partition("/")
    try:
        return float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        return 0.0


def measure(video: Path) -> dict:
    """Raw measurements: streams, duration, loudness, black and silent stretches."""
    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)],
        capture_output=True, text=True, check=True).stdout)
    streams = probe.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    facts = {
        "duration": float(probe.get("format", {}).get("duration", 0) or 0),
        "size_bytes": int(probe.get("format", {}).get("size", 0) or 0),
        "width": int(v["width"]) if v else 0, "height": int(v["height"]) if v else 0,
        "fps": round(_fps(v.get("avg_frame_rate") or v.get("r_frame_rate")), 2) if v else 0.0,
        "has_audio": a is not None, "black": [], "silence": [], "mean_db": None, "max_db": None,
    }
    if not v:
        return facts
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-vf", "blackdetect=d=0.7:pix_th=0.10"]
    if a:
        cmd += ["-af", "silencedetect=noise=-45dB:d=2.5,volumedetect"]
    log = subprocess.run(cmd + ["-f", "null", "-"], capture_output=True, text=True).stderr
    facts["black"] = [(float(s), float(d)) for s, d in
                      re.findall(r"black_start:([\d.]+).*?black_duration:([\d.]+)", log)]
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
    ends = [(float(e), float(d)) for e, d in re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", log)]
    facts["silence"] = [(max(s, 0.0), ends[i][1] if i < len(ends) else facts["duration"] - s)
                        for i, s in enumerate(starts)]
    mean = re.search(r"mean_volume: (-?[\d.]+) dB", log)
    peak = re.search(r"max_volume: (-?[\d.]+) dB", log)
    facts["mean_db"] = float(mean.group(1)) if mean else None
    facts["max_db"] = float(peak.group(1)) if peak else None
    return facts


def inspect(video: Path, expected_seconds: float | None = None, silent_voice: bool = False,
            fallback_shots: list[str] | None = None) -> Report:
    """Measure the video and grade it. `fallback_shots` are explainer drawings that could not be
    made by the paid illustrator and were replaced by something else."""
    report = Report(video=str(video))
    try:
        f = report.facts = measure(video)
    except Exception as exc:
        report.add(CRITICAL, "file", f"cannot be read ({str(exc)[:120]})")
        return report

    if not f["width"]:
        report.add(CRITICAL, "video", "no video stream")
        return report
    if f["height"] <= f["width"]:
        report.add(CRITICAL, "frame", f"not vertical ({f['width']}x{f['height']})")
    elif (f["width"], f["height"]) != (1080, 1920):
        report.add(MINOR, "frame", f"{f['width']}x{f['height']} instead of 1080x1920")
    if f["fps"] < 20:
        report.add(CRITICAL, "fps", f"{f['fps']} frames per second")
    elif f["fps"] < 24:
        report.add(MAJOR, "fps", f"{f['fps']} frames per second")
    d = f["duration"]
    if not 15 <= d <= 180:
        report.add(CRITICAL, "duration", f"{d:.1f}s is outside 15-180s")
    elif expected_seconds and abs(d - expected_seconds) > 3:
        report.add(MAJOR, "sync", f"video is {d:.1f}s but the narration is {expected_seconds:.1f}s")
    if d and f["size_bytes"] * 8 / d < 1_000_000:
        report.add(MINOR, "bitrate", f"{f['size_bytes'] * 8 / d / 1e6:.2f} Mbps")

    if silent_voice:
        report.add(CRITICAL, "voice", "the narration is a silent placeholder (voice service failed)")
    if not f["has_audio"]:
        report.add(CRITICAL, "audio", "no audio stream")
    else:
        if f["mean_db"] is not None:
            if f["mean_db"] < -35:
                report.add(CRITICAL, "loudness", f"almost silent (mean {f['mean_db']} dB)")
            elif f["mean_db"] < -28:
                report.add(MAJOR, "loudness", f"too quiet (mean {f['mean_db']} dB)")
            elif f["mean_db"] > -8:
                report.add(MAJOR, "loudness", f"too loud (mean {f['mean_db']} dB)")
        if f["max_db"] is not None and f["max_db"] > 0.0:
            report.add(MINOR, "clipping", f"peak {f['max_db']} dB")
        for start, length in f["silence"]:
            if start + length >= d - 0.3:      # the calm beat after the last word is intended
                continue
            report.add(CRITICAL if length > 4 else MAJOR, "silence", f"{length:.1f}s of silence at {start:.1f}s")
    for start, length in f["black"]:
        level = CRITICAL if length > 3 else MAJOR if length > 1.5 else MINOR
        report.add(level, "black screen", f"{length:.1f}s at {start:.1f}s")
    if fallback_shots:
        report.add(CRITICAL, "drawings", f"{len(fallback_shots)} explainer drawing(s) were not made by the "
                                         f"illustrator ({', '.join(fallback_shots[:6])})")
    return report


def save(report: Report, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=1), encoding="utf-8")
