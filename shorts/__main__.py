import argparse
import sys

from .config import Config
from .pipeline import make_one


def main() -> int:
    parser = argparse.ArgumentParser(prog="shorts", description="Make (and upload) YouTube Shorts")
    parser.add_argument("--count", type=int, default=1, help="how many Shorts to make")
    parser.add_argument("--upload", action="store_true", help="upload to YouTube after rendering")
    parser.add_argument("--offline", action="store_true", help="ignore the Claude/OmniRoute keys, use the built-in fact bank")
    parser.add_argument("--keep-work", action="store_true", help="keep intermediate files for debugging")
    args = parser.parse_args()

    cfg = Config()
    if args.offline:
        cfg.anthropic_key = ""
        cfg.omniroute_key = ""
    cfg.output_dir.mkdir(parents=True, exist_ok=True)

    failures = 0
    for i in range(args.count):
        print(f"=== Short {i + 1}/{args.count} ===")
        try:
            make_one(cfg, args.upload, args.keep_work)
        except Exception as exc:
            failures += 1
            print(f"[error] {exc}", file=sys.stderr)
    return 1 if failures == args.count else 0


if __name__ == "__main__":
    sys.exit(main())
