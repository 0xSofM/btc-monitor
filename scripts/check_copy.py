#!/usr/bin/env python3
"""Check user-facing copy for stale model terms and common mojibake."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKED_FILES = [
    ROOT / "README.md",
    ROOT / "app" / "README.md",
    ROOT / "app" / "index.html",
    ROOT / "app" / "src" / "components" / "IndicatorExplanation.tsx",
    ROOT / "app" / "src" / "App.tsx",
]

BLOCKED_PATTERNS = [
    "Core-8 V6",
    "core8 v6",
    "Valuation Blend (MVRV Z-Score + NUPL)",
    "MVRV Z-Score and NUPL share",
    "历史版本迭代",
    "BTC定投指标监测系统",
    "鍩",
    "閾",
    "澶",
    "簳",
    "绯",
    "粺",
    "锛",
    "鐩",
    "鏍",
    "�",
]


def main() -> int:
    errors: list[str] = []

    for path in CHECKED_FILES:
        if not path.exists():
            errors.append(f"missing checked file: {path.relative_to(ROOT)}")
            continue

        text = path.read_text(encoding="utf-8")
        for pattern in BLOCKED_PATTERNS:
            if pattern in text:
                errors.append(f"{path.relative_to(ROOT)} contains blocked copy: {pattern}")

    if errors:
        print("COPY CHECK FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Copy check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
