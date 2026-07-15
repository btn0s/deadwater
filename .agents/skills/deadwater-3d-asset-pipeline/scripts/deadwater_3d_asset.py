#!/usr/bin/env python3
"""Inspect and prepare DEADWATER model assets without provider credentials."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def image_size(path: Path) -> tuple[int, int] | None:
    try:
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
                    length_data = stream.read(2)
                    if len(length_data) != 2:
                        return None
                    length = struct.unpack(">H", length_data)[0]
                    if code in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                        payload = stream.read(5)
                        return struct.unpack(">HH", payload[1:5])[::-1]
                    stream.seek(length - 2, 1)
    except (OSError, struct.error, IndexError):
        return None
    return None


def primitive_triangles(primitive: dict, accessors: list[dict]) -> int | None:
    accessor_index = primitive.get("indices")
    if accessor_index is None:
        accessor_index = primitive.get("attributes", {}).get("POSITION")
    if not isinstance(accessor_index, int) or accessor_index >= len(accessors):
        return None
    count = accessors[accessor_index].get("count")
    if not isinstance(count, int):
        return None
    mode = primitive.get("mode", 4)
    if mode == 4:
        return count // 3
    if mode in {5, 6}:
        return max(0, count - 2)
    return 0


def inspect_gltf(path: Path) -> dict:
    document = json.loads(path.read_text())
    accessors = document.get("accessors", [])
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh.get("primitives", [])]
    triangles = [primitive_triangles(primitive, accessors) for primitive in primitives]
    images = []
    missing = []
    for image in document.get("images", []):
        uri = image.get("uri")
        file_path = path.parent / uri if isinstance(uri, str) and not uri.startswith("data:") else None
        exists = file_path.exists() if file_path else None
        if exists is False:
            missing.append(uri)
        images.append({
            "uri": uri,
            "exists": exists,
            "bytes": file_path.stat().st_size if file_path and exists else None,
            "dimensions": image_size(file_path) if file_path and exists else None,
        })
    for buffer in document.get("buffers", []):
        uri = buffer.get("uri")
        if isinstance(uri, str) and not uri.startswith("data:") and not (path.parent / uri).exists():
            missing.append(uri)

    materials = []
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        materials.append({
            "name": material.get("name"),
            "baseColorTexture": "baseColorTexture" in pbr,
            "baseColorFactor": pbr.get("baseColorFactor"),
            "metallicRoughnessTexture": "metallicRoughnessTexture" in pbr,
            "normalTexture": "normalTexture" in material,
            "occlusionTexture": "occlusionTexture" in material,
            "emissiveTexture": "emissiveTexture" in material,
            "alphaMode": material.get("alphaMode", "OPAQUE"),
            "doubleSided": material.get("doubleSided", False),
        })
    position_bounds = []
    for primitive in primitives:
        index = primitive.get("attributes", {}).get("POSITION")
        if isinstance(index, int) and index < len(accessors):
            accessor = accessors[index]
            position_bounds.append({"min": accessor.get("min"), "max": accessor.get("max"), "count": accessor.get("count")})

    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "format": "gltf",
        "counts": {
            "scenes": len(document.get("scenes", [])),
            "nodes": len(document.get("nodes", [])),
            "meshes": len(document.get("meshes", [])),
            "primitives": len(primitives),
            "materials": len(document.get("materials", [])),
            "textures": len(document.get("textures", [])),
            "images": len(document.get("images", [])),
            "skins": len(document.get("skins", [])),
            "animations": len(document.get("animations", [])),
        },
        "estimatedTriangles": sum(value for value in triangles if value is not None),
        "triangleEstimateIncomplete": any(value is None for value in triangles),
        "meshNames": [mesh.get("name") for mesh in document.get("meshes", [])],
        "animationNames": [animation.get("name") for animation in document.get("animations", [])],
        "materials": materials,
        "images": images,
        "positionAccessorBounds": position_bounds,
        "missingExternalUris": sorted(set(missing)),
        "runtimeNotes": [
            "DEADWATER keeps diffuse and optional emissive maps after PS2 material replacement.",
            "Normal, metallic-roughness, AO, alpha mode, sidedness, and most material factors are not preserved.",
            "Accessor bounds are local; verify transformed bounds, pivot, units, and animation visually.",
        ],
    }


def inspect(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(path)
    if path.suffix.lower() == ".gltf":
        return inspect_gltf(path)
    if path.suffix.lower() == ".fbx":
        return {
            "path": str(path),
            "bytes": path.stat().st_size,
            "format": "fbx",
            "note": "Use Blender or the DEADWATER editor for FBX mesh, material, bounds, pivot, skin, and animation inspection.",
        }
    raise ValueError("inspect supports .gltf and .fbx")


def texture_paths(root: Path) -> list[Path]:
    paths = [root] if root.is_file() else list(root.rglob("*"))
    return sorted(path for path in paths if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS)


def textures(root: Path, max_size: int, write: bool) -> dict:
    rows = []
    sips = shutil.which("sips")
    for path in texture_paths(root):
        before = image_size(path)
        needs_resize = bool(before and max(before) > max_size)
        changed = False
        if write and needs_resize:
            if not sips:
                raise RuntimeError("--write requires macOS sips")
            subprocess.run([sips, "-Z", str(max_size), str(path)], check=True, stdout=subprocess.DEVNULL)
            changed = True
        rows.append({
            "path": str(path),
            "before": before,
            "needsResize": needs_resize,
            "changed": changed,
            "after": image_size(path) if changed else before,
        })
    return {"root": str(root), "max": max_size, "write": write, "images": rows}


def strip_pbr(source: Path, output: Path) -> dict:
    if source.resolve() == output.resolve():
        raise ValueError("output must differ from input")
    document = json.loads(source.read_text())
    changed = 0
    for material in document.get("materials", []):
        for key in ("normalTexture", "occlusionTexture"):
            if key in material:
                del material[key]
                changed += 1
        pbr = material.get("pbrMetallicRoughness", {})
        if "metallicRoughnessTexture" in pbr:
            del pbr["metallicRoughnessTexture"]
            changed += 1
        for key in ("metallicFactor", "roughnessFactor"):
            if key in pbr:
                del pbr[key]
                changed += 1
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, indent=2) + "\n")
    return {"source": str(source), "output": str(output), "removedMaterialFields": changed}


def audit_project(root: Path) -> dict:
    models_file = root / "src/engine/models.ts"
    scene_file = root / "src/engine/scene.json"
    text = models_file.read_text()
    urls = sorted(set(re.findall(r"(?:url|texture):\s*'([^']+)'", text)))
    paths = [{"url": url, "exists": (root / "public" / url.lstrip("/")).exists()} for url in urls]
    scene = json.loads(scene_file.read_text())
    nodes = scene.get("nodes", [])
    ids = [node.get("id") for node in nodes]
    duplicates = sorted({value for value in ids if value is not None and ids.count(value) > 1})
    known = set(ids)
    missing_parents = sorted({node.get("parent") for node in nodes if node.get("parent") is not None and node.get("parent") not in known})
    model_components = [component for node in nodes for component in node.get("components", []) if component.get("type") == "model"]
    scene_paths = []
    for component in model_components:
        for key in ("url", "texture"):
            if component.get(key):
                value = component[key]
                scene_paths.append({"nodePath": value, "exists": (root / "public" / value.lstrip("/")).exists()})
    return {
        "root": str(root),
        "registry": {"urls": paths, "missing": [row for row in paths if not row["exists"]]},
        "scene": {
            "nodes": len(nodes),
            "modelComponents": len(model_components),
            "duplicateIds": duplicates,
            "missingParents": missing_parents,
            "missingAssetPaths": [row for row in scene_paths if not row["exists"]],
        },
    }


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    inspect_parser = sub.add_parser("inspect", help="inspect a .gltf or .fbx")
    inspect_parser.add_argument("path", type=Path)
    audit = sub.add_parser("audit-project", help="check registry and scene asset paths")
    audit.add_argument("root", type=Path, nargs="?", default=Path("."))
    texture_parser = sub.add_parser("textures", help="audit or resize PNG/JPEG textures")
    texture_parser.add_argument("path", type=Path)
    texture_parser.add_argument("--max", type=int, default=256, dest="max_size")
    texture_parser.add_argument("--write", action="store_true")
    strip = sub.add_parser("strip-pbr", help="write a glTF copy without ignored PBR map references")
    strip.add_argument("source", type=Path)
    strip.add_argument("output", type=Path)
    return root


def main() -> None:
    args = parser().parse_args()
    if args.command == "inspect":
        result = inspect(args.path)
    elif args.command == "audit-project":
        result = audit_project(args.root.resolve())
    elif args.command == "textures":
        result = textures(args.path, args.max_size, args.write)
    else:
        result = strip_pbr(args.source, args.output)
    print(json.dumps(result, indent=2))
    if args.command == "audit-project" and (result["registry"]["missing"] or result["scene"]["duplicateIds"] or result["scene"]["missingParents"] or result["scene"]["missingAssetPaths"]):
        sys.exit(1)


if __name__ == "__main__":
    main()
