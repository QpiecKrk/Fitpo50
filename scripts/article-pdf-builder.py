#!/usr/bin/env python3

import subprocess
import sys


def print_help() -> None:
    print(
        """FitPo50 article PDF builder

Usage:
  python3 scripts/article-pdf-builder.py [options forwarded to sync_article_pdfs_and_buttons.py]
  python3 scripts/article-pdf-builder.py --slug <slug>

This is the new PDF center. The old implementation remains delegated until
the builder is verified across several article publications.
"""
    )


def main() -> int:
    args = sys.argv[1:]
    if args and args[0] in {"--help", "-h", "help"}:
        print_help()
        return 0

    cmd = ["python3", "scripts/sync_article_pdfs_and_buttons.py", *args]
    print("[ARTICLE-PDF]", " ".join(cmd))
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
