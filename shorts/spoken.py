"""Prepare a script for the voice: numbers become spoken Gulf Arabic words and the
'..' pauses become natural commas, so the narrator never stumbles on digits."""
import re

UNITS = ["", "واحد", "اثنين", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"]
TEENS = ["عشرة", "إحدعش", "ثنعش", "ثلطعش", "أربعطعش", "خمسطعش", "سطعش", "سبعطعش", "ثمنطعش", "تسعطعش"]
TENS = ["", "", "عشرين", "ثلاثين", "أربعين", "خمسين", "ستين", "سبعين", "ثمانين", "تسعين"]
HUNDREDS = ["", "مية", "ميتين", "ثلاثمية", "أربعمية", "خمسمية", "ستمية", "سبعمية", "ثمنمية", "تسعمية"]
# counted forms used before آلاف / ملايين (ثلاث آلاف، سبع ملايين)
COUNTED = ["", "", "", "ثلاث", "أربع", "خمس", "ست", "سبع", "ثمان", "تسع", "عشر"]


def _below_1000(n: int) -> str:
    parts = []
    h, rest = divmod(n, 100)
    if h:
        parts.append(HUNDREDS[h])
    if rest:
        if rest < 10:
            parts.append(UNITS[rest])
        elif rest < 20:
            parts.append(TEENS[rest - 10])
        else:
            t, u = divmod(rest, 10)
            parts.append(f"{UNITS[u]} و{TENS[t]}" if u else TENS[t])
    return " و".join(parts)


def _scale(n: int, one: str, two: str, plural: str) -> str:
    if n == 1:
        return one
    if n == 2:
        return two
    if n <= 10:
        return f"{COUNTED[n]} {plural}"
    return f"{_below_1000(n)} {one}"


def number_words(n: int) -> str:
    if n == 0:
        return "صفر"
    parts = []
    millions, n = divmod(n, 1_000_000)
    thousands, rest = divmod(n, 1000)
    if millions:
        parts.append(_scale(millions, "مليون", "مليونين", "ملايين"))
    if thousands:
        parts.append(_scale(thousands, "ألف", "ألفين", "آلاف"))
    if rest:
        parts.append(_below_1000(rest))
    return " و".join(parts)


def _decimal(m: re.Match) -> str:
    whole, frac = m.group(1), m.group(2)
    return f"{number_words(int(whole))} فاصلة {' '.join(number_words(int(d)) for d in frac)}"


QUESTION = re.compile(r"(^|\s|و|ف)(طيب|مين|من|وش|ليش|لماذا|كيف|هل|وين|متى|ماذا|ايش|إيش)(\s|$)")


def speakable(text: str) -> str:
    text = text.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    # surah names written as letters are read letter by letter: say them as words
    text = re.sub(r"(?<![\u0621-\u064A])يس(?![\u0621-\u064A\u064B-\u0652])", "يَاسِين", text)
    text = re.sub(r"(\d+)\s*%", lambda m: f"{number_words(int(m.group(1)))} بالمية", text)
    text = re.sub(r"(\d+)/(\d+)", lambda m: f"{number_words(int(m.group(1)))} على {number_words(int(m.group(2)))}", text)
    text = re.sub(r"(\d+)\.(\d+)", _decimal, text)
    text = re.sub(r"\d+", lambda m: number_words(int(m.group(0))), text)
    # '..' inside a line is a breath, not a full stop: a comma reads naturally
    # trailing '...' ends the sentence; on a question it must be '؟' so it is read as a question
    end = "؟" if QUESTION.search(text) else "."
    text = re.sub(r"\s*\.{2,}\s*$", end, text)
    text = re.sub(r"\s*\.{2,}\s*(?=[^\s.])", "، ", text)       # inner '..' is a breath
    # taa marbuta joined to the next word (no pause between): give it a damma so the voice
    # links them ("القَهْوَةُ قَدِيمَة") instead of stopping or reading it as a 'h'
    # (only in vowelled words: unvowelled text and spelled-out numbers are left alone)
    text = re.sub(r"(?<=[\u064B-\u0652])ة(?![\u064B-\u0652])(?=\s+[\u0621-\u064A])", "ةُ", text)
    # a sukun on a word's first letter (dialect spelling like نْدَفْعَه، وْشْوَي) trips the voice:
    # drop it and let the voice choose the opening vowel
    text = re.sub(r"(^|[\s،.؟!])([\u0621-\u064A])\u0652", r"\1\2", text)
    return re.sub(r"\s{2,}", " ", text).strip()


HARAKAT = re.compile("[\u064B-\u0652\u0670]")


def plain(text: str) -> str:
    """Text without tashkeel: the voice reads the vowelled script, viewers see clean words."""
    return HARAKAT.sub("", text)


ARABIC_LETTER = re.compile("[\u0621-\u064A]")


def vowel_coverage(text: str) -> float:
    """Share of Arabic letters followed by a vowel mark (tashkeel quality, 0..1).
    Long vowels and a word's last letter often go unmarked, so ~0.6+ is fully vowelled."""
    letters = marked = 0
    for i, ch in enumerate(text):
        if ARABIC_LETTER.match(ch):
            letters += 1
            if i + 1 < len(text) and HARAKAT.match(text[i + 1]):
                marked += 1
    return marked / letters if letters else 1.0
