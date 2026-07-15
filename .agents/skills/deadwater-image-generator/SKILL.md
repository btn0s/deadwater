---
name: deadwater-image-generator
description: Use when creating, editing, sourcing, preparing, or integrating DEADWATER concept art, diffuse textures, emissive maps, signs, decals, UI art, photo sources, or 3D-model reference images.
---

# DEADWATER image generator

## Purpose

Create or source images that survive DEADWATER's 512x448, gamma-space, diffuse-plus-emissive PS2 pipeline. Use Codex's built-in image generation or editing capability when available. No external provider or API key is required.

## Choose the source

1. Reuse project art when it already meets the brief.
2. For tileable materials, search ambientCG or another approved CC0 source through `asset-search` and `docs/ASSETS.md`.
3. For photo textures, search Wikimedia Commons and record the asset-level license.
4. Generate or edit with the built-in image tool for concepts, bespoke diffuse art, signs, decals, icons, or UI.
5. Ask for user-supplied art when identity, typography, or rights require it.

Prefer CC0. Put CC BY attribution in `public/models/CREDITS.md`. Reject NC/ND sources. Record tool, prompt, source URLs, source-image rights, edits, date, and output path.

## Runtime contracts

- Runtime textures belong under `public/textures/`, `public/models/<asset>/textures/`, or the existing UI asset location.
- Reduce runtime images to at most 256 pixels on the longest edge unless a measured exception is approved.
- Keep PNG for alpha, hard-edged signs, decals, icons, and emissive masks. Use JPEG for opaque photographic diffuse textures when appropriate.
- Treat color as raw display values. Do not author a linear-PBR workflow around the image.
- Supply diffuse color and optional emissive only. Normal, metallic, roughness, and AO maps do not affect `PS2Material`.
- Avoid baked directional light and glossy highlights in tileable diffuse textures.
- Make signs and UI readable after reduction and at the normal 4:3 viewing distance.
- Check seams with a 3x3 tile preview before registration.

## Workflow

1. Define use, dimensions, alpha, tiling, palette, readable distance, and license.
2. Generate, edit, or source the image. When editing an existing image, inspect it first and preserve only rights-cleared source material.
3. Keep a higher-resolution working source outside the runtime path when future edits need it.
4. Prepare the runtime copy:

```bash
python3 .agents/skills/deadwater-image-generator/scripts/generate_image.py inspect path/to/image.png
python3 .agents/skills/deadwater-image-generator/scripts/generate_image.py prepare \
  path/to/source.png public/textures/Output.png --max 256
```

5. For a world texture, register its name in `TEXTURE_URLS` in `src/engine/textures.ts`. For model art, update the model's relative texture URI or FBX registry texture.
6. Verify the asset in `/editor.html`, then in the game with `__teleport()` and a player-height screenshot. Use the relevant `__sheet()` area for coverage.
7. Run the production build and check console/network errors.

## Prompt patterns

Diffuse texture:

```text
Square seamless diffuse color texture of [surface] for DEADWATER, muted worn industrial palette, broad readable stains and wear, flat even illumination, no perspective, no baked highlights, no normal-map shading, no text.
```

Sign or decal:

```text
Front-facing [sign/decal] for a grim dock warehouse, simple large shapes, weathered paint, readable at low resolution, limited muted palette, exact text: "[TEXT]", no perspective, transparent or flat background as specified.
```

Concept/reference:

```text
Single [asset] for DEADWATER, full silhouette visible, worn industrial construction, broad material zones that can be modeled and read without PBR maps, neutral background, no motion blur, no cropped parts.
```

## Verification and report

Report source/provenance, prompt or search URL, working and runtime paths, final dimensions/format/alpha, tiling result, registry change, build result, game/editor screenshots, credits change, and remaining integration risks. A generated file is not complete until the runtime copy appears correctly in the game.
