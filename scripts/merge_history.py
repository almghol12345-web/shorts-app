"""Merge this run's publications (output/published.jsonl) into data/history.json."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.history import merge_journal  # noqa: E402

if __name__ == "__main__":
    print(f"added {merge_journal(Path(sys.argv[1]), Path(sys.argv[2]))} entries")
