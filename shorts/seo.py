"""Titles, descriptions, hashtags and tags that help a Short get found.

Hashtags come from three places, in this order:
  1. what is trending on YouTube in Saudi Arabia right now, but only hashtags that are
     about our kind of content (stuffing unrelated trends breaks YouTube's rules and
     shows the video to the wrong audience),
  2. the story's own topic,
  3. evergreen Arabic hashtags for mysteries and true stories.
YouTube shows the first three hashtags above the title and ignores all hashtags when a
video has more than 15, so we keep it to a handful.
"""
import re
from collections import Counter

NICHE_WORDS = ("اكتشاف", "علوم", "علم", "تقنية", "اختراع", "ناسا", "لغز", "ألغاز", "الغاز", "غموض", "غامض", "غامضة", "قصص", "قصة", "قصه", "حقيقية",
               "حقيقي", "اختفاء", "اختفت", "اختفى", "جريمة", "جرائم", "رعب", "مرعب", "غريب", "غرائب",
               "تاريخ", "فضاء", "حقائق", "هل_تعلم", "معلومات", "وثائقي", "اسرار", "أسرار",
               "mystery", "mysteries", "unsolved", "truestory", "documentary", "facts")
EVERGREEN = ["ألغاز", "قصص_حقيقية", "غموض", "ألغاز_لم_تحل", "قصص_غامضة", "معلومات"]
SEARCH_TAGS = ["ألغاز لم تحل", "قصص غامضة حقيقية", "قصص حقيقية", "أغرب القصص",
               "ألغاز حيرت العلماء", "قصص غامضة", "قصص بالسعودي", "دهشة"]
HASHTAG = re.compile(r"#([\w؀-ۿ]+)")


# gaming / off-topic words: a 'stories' hashtag about a game is not our audience
OFF_TOPIC = ("روبلوكس", "roblox", "ماينكرافت", "minecraft", "فورتنايت", "fortnite", "ببجي", "pubg",
             "قيمز", "gaming", "game", "لعبة", "العاب", "ألعاب", "ماب", "سكن", "فري_فاير", "freefire",
             "انمي", "anime", "مسلسل", "مسلسلات", "فلم", "فيلم", "محاكي", "simulator")


def _relevant(tag: str) -> bool:
    """Whole words only: 'قصص_رعب' matches, but 'سراب' or 'تسريب' must not match 'سر'."""
    words = [w for w in re.split(r"[_\s]+", tag.lower().lstrip("#")) if w]
    if any(off in tag.lower() for off in OFF_TOPIC):
        return False
    for w in words:
        for n in NICHE_WORDS:
            base = w[2:] if w.startswith("ال") and len(w) > 4 else w      # drop the Arabic article
            if base == n or w == n:
                return True
    return False


def trending_hashtags(yt, region: str = "SA", limit: int = 3) -> list[str]:
    """Niche-relevant hashtags used by today's most popular videos in the region."""
    counts: Counter = Counter()
    try:
        items = yt.videos().list(part="snippet", chart="mostPopular", regionCode=region,
                                 maxResults=50).execute().get("items", [])
    except Exception as exc:  # trends are a bonus; never block an upload on them
        print(f"[seo] trending lookup failed: {exc}")
        return []
    for v in items:
        sn = v.get("snippet", {})
        text = f"{sn.get('title', '')} {sn.get('description', '')}"
        found = set(HASHTAG.findall(text)) | {t.replace(" ", "_") for t in sn.get("tags", [])}
        for tag in found:
            if _relevant(tag) and len(tag) <= 30:
                counts[tag] += 1
    picked = [t for t, _ in counts.most_common(limit)]
    if picked:
        print(f"[seo] trending in {region}: {picked}")
    return picked


def clean_title(title: str) -> str:
    base = re.sub(r"#shorts", "", title, flags=re.I).strip().rstrip(".").strip()
    return base


def hashtags_for(topic_tags: list[str], trending: list[str], evergreen: list[str] | None = None) -> list[str]:
    """Up to 5 unique hashtags: niche trends first, then the story's topic, then evergreen."""
    out: list[str] = []
    for tag in trending + [t.replace(" ", "_") for t in topic_tags[5:]] + (evergreen or EVERGREEN):
        tag = tag.lstrip("#")
        if tag and tag.lower() not in {o.lower() for o in out}:
            out.append(tag)
        if len(out) == 5:
            break
    return out


NEWS_EVERGREEN = ["اكتشاف", "علوم", "تقنية", "أخبار_العلم", "معلومات", "هل_تعلم"]
# broad Arabic hashtags with big search volume, mixed with the subject's own ones
NEWS_BROAD = ["معلومات", "هل_تعلم", "اكتشاف", "معلومة_تهمك", "ترند"]


def news_hashtags(topic_tags: list[str], trending: list[str]) -> list[str]:
    """YouTube shows the first three hashtags above the title, so they are: the subject's
    field (علوم/تقنية...), a big general one, and the subject itself; then a niche trend
    and one more broad tag. Five in total (more dilutes them)."""
    topic = [t.replace(" ", "_").lstrip("#") for t in topic_tags if t.strip()]
    field_tag = topic[0] if topic else "علوم"
    specific = next((t for t in topic[3:] if "_" in t), topic[3] if len(topic) > 3 else "اكتشاف")
    picked = [field_tag, NEWS_BROAD[0], specific] + trending[:1] + NEWS_BROAD[1:]
    out: list[str] = []
    for tag in picked:
        if tag and tag.lower() not in {o.lower() for o in out}:
            out.append(tag)
    return out[:5]
NEWS_SEARCH_TAGS = ["اكتشاف جديد", "أخبار العلم", "تقنية جديدة", "اختراع جديد", "فضاء",
                    "معلومات جديدة", "علوم", "دهشة"]


def build(title: str, hook: str, topic_tags: list[str], trending: list[str],
          kind: str = "mystery", source: str = "", question: str = "") -> tuple[str, str, list[str]]:
    """Returns (title, description, tags) ready for upload."""
    news = kind == "news"
    if news:
        tags_line = news_hashtags(topic_tags, trending)
        # one searchable topic hashtag in the title too (titles show it as a link)
        final_title = f"{clean_title(title)} 🤯 #{tags_line[0]} #shorts"[:100]
    else:
        tags_line = hashtags_for(list(topic_tags), trending, EVERGREEN)
        final_title = f"{clean_title(title)} 😳 #shorts"[:100]
    if news:
        description = (
            f"{hook}\n\n"
            f"{question or 'وش رأيك فيها؟ اكتب لي في التعليقات'} 👇\n"
            "تابع القناة.. كل يوم شي يبهرك من العالم 🌍\n\n"
            + (f"المصدر: {source}\n\n" if source else "")
            + " ".join(f"#{t}" for t in tags_line) + " #shorts"
        )
    else:
        description = (
            f"{hook}\n\n"
            f"{question or 'وش رأيك أنت؟ اكتب لي في التعليقات'} 👇\n"
            "تابع القناة.. لغز حقيقي جديد كل يوم 🔍\n\n"
            + " ".join(f"#{t}" for t in tags_line) + " #shorts"
        )
    tags, seen, total = [], set(), 0
    for t in [x.replace("_", " ") for x in topic_tags if x] + (NEWS_SEARCH_TAGS if news else SEARCH_TAGS) \
            + [x.replace("_", " ") for x in trending]:
        if t.lower() in seen or total + len(t) > 450:    # YouTube caps tags at 500 characters
            continue
        seen.add(t.lower())
        tags.append(t)
        total += len(t) + 1
    return final_title, description, tags
