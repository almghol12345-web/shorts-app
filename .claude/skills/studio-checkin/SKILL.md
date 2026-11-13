---
name: studio-checkin
description: Daily studio check - failed runs, drawing credit, channel numbers, stock of approved videos. Use in the daily check-in and when something looks stuck.
---
# Daily studio check

1. Runs: list the last day of `daily-shorts.yml` runs. For a failure or a skipped upload read the
   log tail for `[qa]`, `[upload] refused`, `Replicate HTTP 402` (drawing credit empty: tell the owner).
2. Numbers: run `channel-report.yml`, read the `RECENT` and `RETENTION` lines at the end of its log,
   and the saved snapshots in `data/analytics/`. Give them to channel-analyst.
3. Stock: `python scripts/studio.py list`. Fewer than four `approved` videos means start
   produce-short for new ideas now.
4. Stuck videos: anything `blocked`, or at the same stage for more than a day, goes in the report.
5. Comments: comments-manager turns requests into ideas for idea-scout.
6. Report to the owner in 3-5 short Arabic lines: views first, then anything that needs him.
