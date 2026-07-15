#!/usr/bin/env python3
"""Local audio inspection, synthesis, and project-audit helper for DEADWATER."""

from __future__ import annotations

import argparse
import fnmatch
import json
import math
import random
import re
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path


def inspect_one(source: Path) -> dict[str, object]:
    result: dict[str, object] = {"path": str(source), "exists": source.is_file()}
    if not source.is_file():
        return result
    result["bytes"] = source.stat().st_size
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        command = [
            ffprobe,
            "-v", "error",
            "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
            "-of", "json",
            str(source),
        ]
        completed = subprocess.run(command, check=False, capture_output=True, text=True)
        if completed.returncode == 0:
            result["ffprobe"] = json.loads(completed.stdout)
            return result
        result["ffprobe_error"] = completed.stderr.strip()
    if source.suffix.lower() == ".wav":
        with wave.open(str(source), "rb") as audio:
            result["wav"] = {
                "channels": audio.getnchannels(),
                "sample_rate": audio.getframerate(),
                "sample_width": audio.getsampwidth(),
                "frames": audio.getnframes(),
                "duration": audio.getnframes() / audio.getframerate(),
            }
    return result


def audit_project(root: Path) -> int:
    audio_source = root / "src/game/audio.ts"
    sounds = root / "public/sounds"
    credits = root / "public/models/CREDITS.md"
    errors: list[str] = []
    if not audio_source.is_file():
        errors.append("missing src/game/audio.ts")
        source_text = ""
    else:
        source_text = audio_source.read_text(encoding="utf-8")
    if not sounds.is_dir():
        errors.append("missing public/sounds")
        shipped: list[Path] = []
    else:
        shipped = sorted(path for path in sounds.iterdir() if path.is_file())

    patterns = re.findall(r"/sounds/([^`'\"]+)", source_text)
    normalized = [re.sub(r"\$\{[^}]+\}", "*", pattern) for pattern in patterns]
    referenced = [path for path in shipped if any(fnmatch.fnmatch(path.name, pattern) for pattern in normalized)]
    unreferenced = [path.name for path in shipped if path not in referenced]
    missing_patterns = [pattern for pattern in normalized if not any(fnmatch.fnmatch(path.name, pattern) for path in shipped)]
    if missing_patterns:
        errors.extend(f"no shipped file matches /sounds/{pattern}" for pattern in missing_patterns)
    if not credits.is_file() or "Sounds" not in credits.read_text(encoding="utf-8"):
        errors.append("credits do not contain a Sounds section")

    report = {
        "root": str(root.resolve()),
        "shipped": [path.name for path in shipped],
        "referenced": [path.name for path in referenced],
        "unreferenced": unreferenced,
        "patterns": normalized,
        "errors": errors,
    }
    print(json.dumps(report, indent=2))
    return 1 if errors else 0


def synth_sample(kind: str, t: float, duration: float, rng: random.Random, state: dict[str, float]) -> float:
    phase = t / max(duration, 1e-6)
    if kind == "click":
        return (rng.random() * 2 - 1) * math.exp(-phase * 45) + 0.35 * math.sin(2 * math.pi * 900 * t) * math.exp(-phase * 60)
    if kind == "clunk":
        return 0.7 * math.sin(2 * math.pi * 92 * t) * math.exp(-phase * 8) + (rng.random() * 2 - 1) * 0.22 * math.exp(-phase * 20)
    if kind == "hum":
        return 0.65 * math.sin(2 * math.pi * 60 * t) + 0.22 * math.sin(2 * math.pi * 120 * t)
    noise = rng.random() * 2 - 1
    state["lp"] += (noise - state["lp"]) * (0.025 if kind == "wash" else 0.08)
    if kind == "wash":
        return state["lp"] * (0.55 + 0.3 * math.sin(2 * math.pi * phase))
    return state["lp"] * math.sin(math.pi * min(1, phase))


def synth(output: Path, kind: str, duration: float, sample_rate: int, seed: int) -> int:
    if duration <= 0 or duration > 60:
        raise ValueError("duration must be greater than zero and at most 60 seconds")
    if sample_rate < 8_000 or sample_rate > 192_000:
        raise ValueError("sample rate must be between 8000 and 192000")
    rng = random.Random(seed)
    count = round(duration * sample_rate)
    state = {"lp": 0.0}
    values = [synth_sample(kind, index / sample_rate, duration, rng, state) for index in range(count)]
    peak = max(1e-9, max(abs(value) for value in values))
    scale = 0.85 / peak
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        frames = b"".join(struct.pack("<h", round(max(-1, min(1, value * scale)) * 32767)) for value in values)
        audio.writeframes(frames)
    print(json.dumps({"path": str(output), "kind": kind, "duration": duration, "sample_rate": sample_rate, "seed": seed}, indent=2))
    return 0


def loop_check(source: Path, window_ms: float) -> int:
    with wave.open(str(source), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError("loop-check currently expects mono 16-bit PCM WAV")
        count = min(audio.getnframes() // 2, max(1, round(audio.getframerate() * window_ms / 1000)))
        start = audio.readframes(count)
        audio.setpos(audio.getnframes() - count)
        end = audio.readframes(count)
    first = struct.unpack(f"<{count}h", start)
    last = struct.unpack(f"<{count}h", end)
    seam_jump = abs(first[0] - last[-1]) / 32767
    steps = [abs(b - a) for values in (first, last) for a, b in zip(values, values[1:])]
    local_step_rms = math.sqrt(sum(step * step for step in steps) / max(1, len(steps))) / 32767
    slope_jump = abs((first[1] - first[0]) - (last[-1] - last[-2])) / 32767 if count > 1 else None
    print(json.dumps({
        "path": str(source),
        "window_ms": window_ms,
        "normalized_boundary_jump": seam_jump,
        "normalized_slope_jump": slope_jump,
        "normalized_local_step_rms": local_step_rms,
        "boundary_to_local_step_ratio": seam_jump / local_step_rms if local_step_rms else None,
        "note": "Numeric continuity is diagnostic; audition repeated loop boundaries before approval.",
    }, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    inspect_cmd = commands.add_parser("inspect", help="print metadata for audio files")
    inspect_cmd.add_argument("paths", type=Path, nargs="+")
    audit_cmd = commands.add_parser("audit-project", help="check shipped audio references and credits")
    audit_cmd.add_argument("root", type=Path, nargs="?", default=Path("."))
    synth_cmd = commands.add_parser("synth", help="create a reproducible mono WAV starting point")
    synth_cmd.add_argument("output", type=Path)
    synth_cmd.add_argument("--kind", choices=["click", "clunk", "hum", "wash", "noise"], default="click")
    synth_cmd.add_argument("--duration", type=float, default=0.18)
    synth_cmd.add_argument("--sample-rate", type=int, default=44_100)
    synth_cmd.add_argument("--seed", type=int, default=1)
    loop_cmd = commands.add_parser("loop-check", help="measure a mono WAV boundary discontinuity")
    loop_cmd.add_argument("source", type=Path)
    loop_cmd.add_argument("--window-ms", type=float, default=10)
    return root


def main() -> int:
    args = parser().parse_args()
    if args.command == "inspect":
        reports = [inspect_one(path) for path in args.paths]
        print(json.dumps(reports, indent=2))
        return 1 if any(not report["exists"] for report in reports) else 0
    if args.command == "audit-project":
        return audit_project(args.root)
    if args.command == "synth":
        return synth(args.output, args.kind, args.duration, args.sample_rate, args.seed)
    if args.command == "loop-check":
        return loop_check(args.source, args.window_ms)
    raise AssertionError(args.command)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"deadwater_audio_asset.py: {error}", file=sys.stderr)
        raise SystemExit(1)
