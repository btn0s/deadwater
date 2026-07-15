#!/usr/bin/env python3
"""Inspect or prepare a DEADWATER runtime image. Generation uses Codex tools."""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import subprocess
from pathlib import Path


def dimensions(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()[:32]
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return struct.unpack(">II", data[16:24])
    if data.startswith(b"\xff\xd8"):
        with path.open("rb") as stream:
            stream.read(2)
            while True:
                marker = stream.read(1)
                if not marker:
                    return None
                if marker != b"\xff":
                    continue
                while marker == b"\xff":
                    marker = stream.read(1)
                code = marker[0]
                if code in {0xD8, 0xD9}:
                    continue
                size = struct.unpack(">H", stream.read(2))[0]
                if code in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                    payload = stream.read(5)
                    height, width = struct.unpack(">HH", payload[1:5])
                    return width, height
                stream.seek(size - 2, 1)
    return None


def inspect(path: Path) -> dict:
    size = dimensions(path)
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "dimensions": size,
        "runtimeMax": 256,
        "needsReduction": bool(size and max(size) > 256),
        "note": "Use PNG for alpha/emissive/sign art and JPEG for suitable opaque diffuse art.",
    }


def prepare(source: Path, output: Path, maximum: int) -> dict:
    if not source.exists():
        raise FileNotFoundError(source)
    sips = shutil.which("sips")
    if not sips:
        raise RuntimeError("prepare requires macOS sips")
    output.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != output.resolve():
        shutil.copy2(source, output)
    subprocess.run([sips, "-Z", str(maximum), str(output)], check=True, stdout=subprocess.DEVNULL)
    return {"source": str(source), "output": str(output), "max": maximum, "result": inspect(output)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    inspect_parser = commands.add_parser("inspect")
    inspect_parser.add_argument("path", type=Path)
    prep_parser = commands.add_parser("prepare")
    prep_parser.add_argument("source", type=Path)
    prep_parser.add_argument("output", type=Path)
    prep_parser.add_argument("--max", type=int, default=256, dest="maximum")
    args = parser.parse_args()
    result = inspect(args.path) if args.command == "inspect" else prepare(args.source, args.output, args.maximum)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
