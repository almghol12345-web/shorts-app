---
name: produce-short
description: Take one video from idea to published through the studio pipeline, with the production board as the single source of truth. Use for every new explainer Short.
---
# Produce one Short

The board (`python scripts/studio.py list`) says where each video is. Never skip a stage; every
move needs evidence. Publishing is refused by the pipeline unless the board says `approved`.

| Stage | Who | Evidence to record |
|---|---|---|
| idea | idea-scout (growth-strategist and competitor-scout feed it) | the question and why |
| script | script-writer, then hook-doctor, retention-editor, pronunciation-coach | entry added to `data/requests.json` |
| fact_check | fact-checker (+ culture-reviewer for religion, state, customs) | verdict and sources |
| storyboard | visual-director writes one "doodle, ..." prompt per line | scene count equals line count |
| render | dispatch `daily-shorts.yml` with `upload=false`, `quality=video`, `topic` | run id |
| qa | automatic gate (`[qa]` lines in the run log) + read the preview sheet (previews branch) | qa score, sheet reviewed |
| approved | critical-reviewer -> quality-defender -> final-judge | score and verdict |

Commands:

```
python scripts/studio.py add "<topic>" --by idea-scout --note "<question>"
python scripts/studio.py advance "<topic>" <stage> --by <agent> --note "<evidence>"
python scripts/studio.py rework "<topic>" <stage> --by <agent> --note "<reason>"
python scripts/studio.py next        # what the publishing slot uploads
```

Rules:
- Run independent agents in parallel (three writers on three topics); run dependent ones in order.
- A defect in one picture: change only that scene's prompt and render again; cached scenes are free.
- After a rework push the board before dispatching, or the runner sees the old stage.
- Commit and push `data/requests.json` and `data/studio/` together.
- Publish with `daily-shorts.yml` (`upload=true`, the topic, `quality=video`). The pipeline checks
  the board, the history (never twice) and the quality gate itself.
- More than 4 reworks blocks the video: tell the owner instead of looping.
