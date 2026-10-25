"""Builds an ASS subtitle file: big animated captions + a progress bar.

libass (inside ffmpeg) shapes Arabic and handles right-to-left text.
"""
from .voice import Segment

MAX_WORDS = 3


def _ts(seconds: float) -> str:
    cs = int(round(max(seconds, 0) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def chunk(segment: Segment, max_words: int = MAX_WORDS) -> list[Segment]:
    """Split a spoken line into short caption pieces timed by text length."""
    words = segment.text.split()
    groups = [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)] or [""]
    total_chars = sum(len(g) for g in groups) or 1
    span = segment.end - segment.start
    out, t = [], segment.start
    for g in groups:
        d = span * len(g) / total_chars
        out.append(Segment(g, t, t + d))
        t += d
    out[-1].end = segment.end
    return out


def _escape(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def build_ass(segments: list[Segment], total: float, width: int, height: int, font: str) -> str:
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{font},150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,12,6,5,70,70,0,1
Style: Hook,{font},160,&H0000E5FF,&H0000E5FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,13,7,5,70,70,0,1
Style: Bar,{font},20,&H0000E5FF,&H0000E5FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    cy = int(height * 0.58)
    for i, seg in enumerate(segments):
        style = "Hook" if i == 0 else "Caption"
        # Hold the last piece through the pause so captions never blink off.
        hold_until = segments[i + 1].start if i + 1 < len(segments) else total
        pieces = chunk(seg)
        pieces[-1].end = max(pieces[-1].end, hold_until)
        for piece in pieces:
            if not piece.text:
                continue
            anim = r"{\pos(%d,%d)\fscx80\fscy80\t(0,90,\fscx108\fscy108)\t(90,160,\fscx100\fscy100)}" % (width // 2, cy)
            events.append(f"Dialogue: 1,{_ts(piece.start)},{_ts(piece.end)},{style},,0,0,0,,{anim}{_escape(piece.text)}")

    # Progress bar along the bottom edge, grows left -> right over the whole video.
    ms = int(total * 1000)
    bar = r"{\pos(0,%d)\fscx0\t(0,%d,\fscx100)\p1}m 0 0 l %d 0 l %d 14 l 0 14{\p0}" % (height - 14, ms, width, width)
    events.append(f"Dialogue: 0,{_ts(0)},{_ts(total)},Bar,,0,0,0,,{bar}")
    return header + "\n".join(events) + "\n"
