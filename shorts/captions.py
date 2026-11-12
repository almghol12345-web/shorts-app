"""Builds an ASS subtitle file: big captions synced word-by-word to the voice,
plus a progress bar. libass (inside ffmpeg) shapes Arabic right-to-left."""
from .voice import Segment

MAX_WORDS = 2
CAPTION_Y = 0.68          # share of the height: below centre, above YouTube's buttons
CAPTION_Y_NARRATOR = 0.30  # above the narrator's head when he is on screen


def _ts(seconds: float) -> str:
    cs = int(round(max(seconds, 0) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _escape(text: str) -> str:
    from .spoken import plain
    text = plain(text)
    # commas and dots at a caption's edge show on the wrong side in right-to-left text: drop them
    text = text.replace("،", " ").replace(",", " ").replace(".", " ").strip()
    text = " ".join(text.split())
    return text.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def split_lines(words: list[Segment], line_sizes: list[int]) -> list[list[Segment]]:
    """Regroup spoken words into the script's lines (so a caption never spans two sentences)."""
    if sum(line_sizes) != len(words) or not line_sizes:
        return [words]
    out, i = [], 0
    for n in line_sizes:
        if n:
            out.append(words[i:i + n])
        i += n
    return out


def pieces(words: list[Segment], line_sizes: list[int], total: float) -> list[tuple[int, Segment]]:
    """(line index, caption) pairs. Each caption appears when its first word is
    spoken and stays until the next caption starts, so nothing blinks."""
    items: list[tuple[int, Segment]] = []
    for li, line in enumerate(split_lines(words, line_sizes)):
        for k in range(0, len(line), MAX_WORDS):
            group = line[k:k + MAX_WORDS]
            items.append((li, Segment(" ".join(w.text for w in group), group[0].start, group[-1].end)))
    for n, (_, seg) in enumerate(items):
        seg.end = items[n + 1][1].start if n + 1 < len(items) else total
    return items


def build_ass(words: list[Segment], line_sizes: list[int], total: float,
              width: int, height: int, font: str, caption_y: float = CAPTION_Y,
              cards: list[tuple] | None = None) -> str:
    landscape = width > height
    k = 0.6 if landscape else 1.0          # smaller words on a wide screen (subtitle size)
    if landscape:
        caption_y = 0.86                   # bottom of the frame, like normal subtitles
    fs, hs, ol, hol = int(140 * k), int(150 * k), int(12 * k), int(13 * k)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{font},{fs},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,{ol},6,5,70,70,0,1
Style: Hook,{font},{hs},&H00303BFF,&H00303BFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,{hol},7,5,70,70,0,1
Style: Card,{font},{int(fs * 1.25)},&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,3,{int(30 * k)},0,5,70,70,0,1
Style: CardSub,{font},{int(fs * 0.7)},&H0000E1FF,&H0000E1FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,{ol},4,5,70,70,0,1
Style: Bar,{font},20,&H00303BFF,&H00303BFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    cy = int(height * caption_y)
    for line_index, seg in pieces(words, line_sizes, total):
        style = "Hook" if line_index == 0 else "Caption"
        anim = r"{\pos(%d,%d)\fscx85\fscy85\t(0,80,\fscx105\fscy105)\t(80,140,\fscx100\fscy100)}" % (width // 2, cy)
        events.append(f"Dialogue: 1,{_ts(seg.start)},{_ts(seg.end)},{style},,0,0,0,,{anim}{_escape(seg.text)}")

    # Chapter cards: a boxed heading that pops in, with the story's name under it
    for start, end, head, sub in (cards or []):
        pop = r"{\pos(%d,%d)\fad(200,250)\fscx70\fscy70\t(0,180,\fscx105\fscy105)\t(180,300,\fscx100\fscy100)}" % (
            width // 2, int(height * 0.42))
        events.append(f"Dialogue: 2,{_ts(start)},{_ts(end)},Card,,0,0,0,,{pop}{_escape(head)}")
        if sub:
            events.append(f"Dialogue: 2,{_ts(start + 0.15)},{_ts(end)},CardSub,,0,0,0,,"
                          + r"{\pos(%d,%d)\fad(250,250)}" % (width // 2, int(height * 0.56)) + _escape(sub))

    # Progress bar along the bottom edge, grows left -> right over the whole video.
    ms = int(total * 1000)
    bar = r"{\pos(0,%d)\fscx0\t(0,%d,\fscx100)\p1}m 0 0 l %d 0 l %d 14 l 0 14{\p0}" % (height - 14, ms, width, width)
    events.append(f"Dialogue: 0,{_ts(0)},{_ts(total)},Bar,,0,0,0,,{bar}")
    return header + "\n".join(events) + "\n"
