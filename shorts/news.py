"""Fresh news for "something new just happened in the world" Shorts: space discoveries,
science breakthroughs and new technology from the last few days.

Headlines come from public RSS feeds of well-known science / tech outlets. Claude picks the
most surprising one, then writes the Short only from that article's own text, and the
article link goes in the video description as the source.
"""
import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests

FEEDS = [
    "https://www.sciencedaily.com/rss/top/science.xml",
    "https://www.sciencedaily.com/rss/top/technology.xml",
    "https://www.nasa.gov/news-release/feed/",
    "https://www.space.com/feeds/all",
    "https://phys.org/rss-feed/breaking/",
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "https://www.newscientist.com/feed/home/",
]
UA = {"User-Agent": "Mozilla/5.0 (shorts-bot; news headlines)"}
MAX_AGE_DAYS = 4


def _text(el, *names) -> str:
    for name in names:
        found = el.find(name)
        if found is not None and (found.text or found.get("href")):
            return (found.text or found.get("href") or "").strip()
    return ""


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw or ""))).strip()


def _date(raw: str):
    if not raw:
        return None
    try:
        d = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def parse_feed(xml_text: str) -> list[dict]:
    """RSS 2.0 or Atom -> [{title, summary, link, date}]."""
    root = ET.fromstring(xml_text)
    atom = "{http://www.w3.org/2005/Atom}"
    items = root.findall(".//item") or root.findall(f".//{atom}entry")
    out = []
    for it in items:
        link = _text(it, "link", f"{atom}link")
        title = _clean(_text(it, "title", f"{atom}title"))
        summary = _clean(_text(it, "description", f"{atom}summary", f"{atom}content"))
        date = _date(_text(it, "pubDate", f"{atom}updated", f"{atom}published"))
        if title and link.startswith("http"):
            out.append({"title": title, "summary": summary[:500], "link": link, "date": date})
    return out


def headlines(used: list[str], limit: int = 30) -> list[dict]:
    """Recent headlines not covered before (`used` holds earlier topics / links)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    seen = {u.lower() for u in used}
    picked, titles = [], set()
    for url in FEEDS:
        try:
            resp = requests.get(url, headers=UA, timeout=20)
            resp.raise_for_status()
            items = parse_feed(resp.text)
        except Exception as exc:  # one dead feed must not stop the others
            print(f"[news] feed failed {url.split('/')[2]}: {type(exc).__name__}")
            continue
        for it in items[:15]:
            if it["date"] and it["date"] < cutoff:
                continue
            key = it["title"].lower()[:60]
            if it["link"].lower() in seen or key in titles:
                continue
            titles.add(key)
            picked.append(it)
    picked.sort(key=lambda it: it["date"] or cutoff, reverse=True)
    print(f"[news] {len(picked)} fresh headlines")
    return picked[:limit]


def article_text(link: str, limit: int = 7000) -> str:
    """Readable text of the article page (paragraphs only)."""
    try:
        resp = requests.get(link, headers=UA, timeout=25)
        resp.raise_for_status()
    except Exception as exc:
        print(f"[news] article fetch failed: {type(exc).__name__}")
        return ""
    paras = re.findall(r"<p[^>]*>(.*?)</p>", resp.text, flags=re.S | re.I)
    text = " ".join(_clean(p) for p in paras if len(_clean(p)) > 60)
    return text[:limit]
