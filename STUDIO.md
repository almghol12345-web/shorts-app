# The studio: how a video is made, checked and published

This file describes what actually runs. Nothing here is decorative: every agent is called from
the `produce-short` or `studio-checkin` skill, and every gate marked "code" is enforced by the
program, not by instructions.

## Pipeline

```
IDEA -> RESEARCH -> SCRIPT -> FACT CHECK -> STORYBOARD -> VISUALS -> ANIMATION -> VOICE
     -> EDIT -> SUBTITLES -> AUDIO -> FINAL QA -> PUBLISH -> PERFORMANCE
```

| Step | Done by | Proof it happened |
|---|---|---|
| Idea, research | agents: growth-strategist, competitor-scout, idea-scout | board entry `idea` |
| Script | agents: script-writer, hook-doctor, retention-editor, pronunciation-coach | entry in `data/requests.json`, board `script` |
| Fact check | agents: fact-checker, culture-reviewer | board `fact_check` with sources |
| Storyboard | agent: visual-director | one picture prompt per line, board `storyboard` |
| Visuals, animation | code: `shorts/background.py`, `shorts/replicate.py` (Replicate) | scene clips, cached between runs |
| Voice | code: `shorts/darijat.py` (Darijat, voice جسار) | narration audio with timings |
| Edit, subtitles, music | code: `shorts/render.py`, `shorts/captions.py`, `shorts/music.py` (ffmpeg) | the mp4 |
| Final QA | code: `shorts/qa.py`; agents: critical-reviewer, quality-defender, final-judge | `output/qa.json`, board `qa` then `approved` |
| Publish | code: `shorts/upload.py` through `daily-shorts.yml` | `data/history.json` |
| Performance | code: `scripts/channel_report.py`; agents: channel-analyst, comments-manager | `data/analytics/*.json` |

## Gates enforced in code (cannot be talked around)

1. **Board gate** (`shorts/studio.py`, checked in `shorts/pipeline.py` and `scripts/upload_existing.py`):
   a tracked video uploads only at stage `approved`; stages cannot be skipped; every move needs evidence.
2. **Never twice**: a topic already in `data/history.json` is refused.
3. **Quality gate** (`shorts/qa.py`): measured on the finished file with ffprobe/ffmpeg. Score out of
   100, publish needs 95 and no critical finding. Checks: vertical 1080x1920, frame rate, length 15-180s,
   picture and narration the same length, audio present, loudness, clipping, silent stretches, black
   screens, silent-placeholder voice, explainer drawings not made by the illustrator.
4. **No endless loops**: more than 4 reworks blocks a video until a person decides.
5. **Audit trail**: `data/studio/log.jsonl` records every board move with who and why.

## State that survives between sessions

- `data/studio/board.json` - where each planned video is.
- `data/history.json` - what is on the channel ("published" is read from here only).
- `data/analytics/` - dated channel snapshots (views, likes, retention when the login allows it).
- `scene_cache/` on the runner - paid drawings and clips; a fix re-renders only the changed scene.

## Departments and who covers them

| Department | Covered by |
|---|---|
| Strategy and growth | growth-strategist, channel-analyst |
| Market research | competitor-scout, idea-scout |
| Writing | script-writer, hook-doctor, retention-editor |
| Language and voice | pronunciation-coach, `shorts/spoken.py`, `shorts/darijat.py` |
| Research and accuracy | fact-checker |
| Culture and compliance | culture-reviewer |
| Art direction | visual-director, `shorts/background.py` |
| Animation and edit | `shorts/replicate.py`, `shorts/render.py`, `shorts/captions.py` |
| Audio | `shorts/music.py`, audio checks in `shorts/qa.py` |
| Quality assurance | `shorts/qa.py`, quality-gate, critical-reviewer, quality-defender, final-judge |
| Publishing and SEO | seo-specialist, `shorts/seo.py`, `shorts/upload.py` |
| Community and data | comments-manager, `scripts/channel_report.py` |

17 agents and the code modules above cover the twelve departments. Extra agent files are added
only when a job is really called from a skill.

## Known limits

- Pronunciation (for example ق read as a hamza) is not detected automatically; `check-speech.yml`
  transcribes a video on request, but speech recognition tends to "correct" such slips.
- Picture quality (does the drawing explain its line, are there people) is judged by reading the
  preview sheet, not by code.
- Retention numbers need the `yt-analytics.readonly` permission on the saved YouTube login.
