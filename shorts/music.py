"""Background music composed in code for each story's mood, so every track belongs to the
channel (no licences, no Content ID claims).

Moods: sea, space, desert (Hijaz maqam), ancient, crime (heartbeat tension), mystery.
Each bed opens with a low impact under the hook and is mixed quietly; the renderer ducks
it under the voice.
"""
import wave
from pathlib import Path

import numpy as np

SR = 44100
TARGET_RMS = 0.05            # about -26 dBFS: a bed, never louder than the narrator

MOOD_WORDS = {
    "sea": ("بحر", "البحر", "سفينة", "سفن", "محيط", "المحيط", "غواص", "منارة", "جزيرة", "ocean", "sea",
            "ship", "underwater", "lighthouse", "island"),
    "space": ("فضاء", "الفضاء", "إشارة", "نجم", "نجوم", "تلسكوب", "كوكب", "مذنب", "نيزك", "أضواء",
              "space", "star", "telescope", "planet", "signal", "meteor"),
    "desert": ("صحراء", "الصحراء", "السعودية", "العلا", "تيماء", "عمان", "الربع", "رمل", "desert",
               "saudi", "arabia", "sand", "oman"),
    "ancient": ("آثار", "حضارات", "حضارة", "تاريخ", "أهرامات", "الأهرامات", "معبد", "مخطوطة", "روما",
                "إنكا", "pyramid", "ancient", "ruins", "temple", "manuscript", "roman"),
    "crime": ("جرائم", "جريمة", "قاتل", "اختفاءات", "اختفى", "اختفت", "طائرة", "طيارة", "الشرطة",
              "شفرة", "crime", "killer", "police", "airplane", "vanished", "cipher"),
}


def mood_for(*texts: str) -> str:
    """Pick the mood whose words appear most in the story's title, tags and visual plan."""
    blob = " ".join(texts).lower()
    scores = {m: sum(blob.count(w) for w in words) for m, words in MOOD_WORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "mystery"


# ------------------------------------------------------------------ building blocks

def _t(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def _pad(t: np.ndarray, freqs, lfo=0.07) -> np.ndarray:
    out = np.zeros_like(t)
    for k, f in enumerate(freqs):
        swell = 0.55 + 0.45 * np.sin(2 * np.pi * (lfo + 0.013 * k) * t + k)
        detune = np.sin(2 * np.pi * f * 1.003 * t)                  # slight chorus
        out += (np.sin(2 * np.pi * f * t) + 0.5 * detune) * swell / (k + 1.5)
    return out


def _noise(n: int, rng, smooth: int) -> np.ndarray:
    """Soft filtered noise (wind / surf) by moving average."""
    x = rng.standard_normal(n + smooth)
    kernel = np.ones(smooth) / smooth
    return np.convolve(x, kernel, mode="valid")[:n]


def _impact(t: np.ndarray) -> np.ndarray:
    """Low 'boom' under the hook."""
    env = np.exp(-2.4 * t) * (t < 2.5)
    return 0.9 * np.sin(2 * np.pi * (50 - 12 * t) * t) * env


def _pluck(freq: float, seconds: float, rng) -> np.ndarray:
    """Karplus-Strong plucked string (an oud-like note)."""
    n = int(seconds * SR)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out


def _place(track: np.ndarray, sound: np.ndarray, at: float, gain: float) -> None:
    i = int(at * SR)
    if i >= len(track):
        return
    j = min(len(track), i + len(sound))
    track[i:j] += gain * sound[: j - i]


def _drum(seconds: float = 1.2) -> np.ndarray:
    t = _t(seconds)
    return np.sin(2 * np.pi * (70 * np.exp(-3 * t) + 38) * t) * np.exp(-5 * t)


# ------------------------------------------------------------------ moods

def compose(mood: str, seconds: float, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = _t(seconds)
    n = len(t)
    if mood == "sea":
        music = _pad(t, [55.0, 82.4, 110.0, 130.8])                       # A minor, deep
        waves = _noise(n, rng, 400) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.12 * t)) ** 2
        music = music + 3.0 * waves
    elif mood == "space":
        music = _pad(t, [110.0, 164.8, 220.0, 329.6], lfo=0.04)
        for at in np.arange(0.8, seconds, 0.9):                           # glassy shimmer
            f = rng.choice([880.0, 987.8, 1318.5, 1760.0])
            ping = np.sin(2 * np.pi * f * _t(2.5)) * np.exp(-1.8 * _t(2.5))
            _place(music, ping, at + rng.uniform(0, 0.4), 0.18)
    elif mood == "desert":
        music = 0.8 * _pad(t, [73.4, 110.0], lfo=0.05)                     # drone on D
        hijaz = [146.8, 155.6, 185.0, 196.0, 220.0, 233.1, 261.6, 293.7]  # D Hijaz
        at, k = 1.0, 0
        while at < seconds:
            note = hijaz[min(len(hijaz) - 1, max(0, k + rng.integers(-1, 2)))]
            k = hijaz.index(note)
            _place(music, _pluck(note, 1.6, rng), at, 0.55)
            at += rng.choice([0.6, 0.9, 1.2])
        music = music + 1.5 * _noise(n, rng, 900)                          # wind
    elif mood == "ancient":
        music = _pad(t, [49.0, 73.4, 98.0], lfo=0.05)
        for at in np.arange(1.5, seconds, 1.6):
            _place(music, _drum(), at, 0.9)
            _place(music, _drum(0.8), at + 0.4, 0.45)
    elif mood == "crime":
        music = 0.6 * _pad(t, [61.7, 65.4], lfo=0.09)                      # B-C rub: tension
        music += 0.12 * np.sin(2 * np.pi * 1046.5 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.2 * t))
        for at in np.arange(1.0, seconds, 60 / 68):                        # heartbeat ~68 bpm
            _place(music, _drum(0.5), at, 0.8)
            _place(music, _drum(0.4), at + 0.22, 0.5)
    else:                                                                  # mystery
        music = _pad(t, [55.0, 82.41, 110.6, 164.8])
        music = music + 1.2 * _noise(n, rng, 600)
    music = music + _impact(t)
    music -= music.mean()
    rms = np.sqrt(np.mean(music ** 2)) or 1.0
    music *= TARGET_RMS / rms
    # fade in quickly, fade out at the end
    fade_in, fade_out = int(0.3 * SR), int(1.5 * SR)
    music[:fade_in] *= np.linspace(0, 1, fade_in)
    music[-fade_out:] *= np.linspace(1, 0, fade_out)
    return np.clip(music, -0.95, 0.95)


def write_bed(mood: str, seconds: float, out: Path) -> Path:
    data = (compose(mood, seconds) * 32767).astype(np.int16)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    return out
