#!/usr/bin/env python3
"""Audit a DEADWATER director report for evidence required by its scope."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


BASE = [
    "skill-loading ledger",
    "reference ledger",
    "phase ledger",
    "files changed",
    "verification",
    "remaining risks",
]

SCOPED = {
    "graphics": [
        "ps2 visual scorecard",
        "hardware fact",
        "deadwater policy",
        "modern cheat",
        "renderer",
        "screenshot",
    ],
    "physics": ["rapier", "collider", "physics"],
    "assets": [
        "asset provenance and processing ledger",
        "license",
        "runtime path",
        "in-game verification",
    ],
    "audio": ["audio", "user gesture", "cleanup"],
    "release": ["production build", "preview", "console", "page error"],
}


def normalize(text: str) -> str:
    text = text.lower().replace("skill loading ledger", "skill-loading ledger")
    text = text.replace("asset ledger", "asset provenance and processing ledger")
    text = text.replace("asset provenance ledger", "asset provenance and processing ledger")
    return re.sub(r"\s+", " ", text)


def missing_markers(text: str, markers: list[str]) -> list[str]:
    missing: list[str] = []
    for marker in markers:
        if not re.search(r"\b" + re.escape(marker) + r"\b", text):
            missing.append(marker)
    return missing


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path)
    for flag in SCOPED:
        parser.add_argument(f"--{flag}", action="store_true")
    args = parser.parse_args()

    if not args.report.is_file():
        print(f"Missing report: {args.report}")
        return 1

    text = normalize(args.report.read_text(encoding="utf-8"))
    required = list(BASE)
    for flag, markers in SCOPED.items():
        if getattr(args, flag):
            required.extend(markers)

    missing = missing_markers(text, required)
    if missing:
        print("Director report audit failed:")
        for marker in missing:
            print(f"- missing: {marker}")
        return 1

    print("Director report audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
