---
name: deadwater-3d-asset-pipeline
description: Use when finding, licensing, downloading, converting, inspecting, preparing, registering, placing, animating, or debugging 3D models and colliders for DEADWATER.
---

# DEADWATER 3D asset pipeline

## Purpose

Bring a 3D asset from a licensed source into `scene.json` with correct scale, pivot, texture budget, PS2 material behavior, collision, credits, and in-game evidence. Search existing CC0 and CC BY sources first. AI-generated geometry is optional and follows the same checks.

## Required references

Load only the references needed for the task, and record them in the final evidence:

- `references/asset-sources-and-licenses.md` before searching, downloading, or approving a license.
- `references/model-preparation.md` before conversion, geometry cleanup, rigging, animation, or texture stripping.
- `references/threejs-integration.md` before editing the registry or placing the asset.
- `references/image-generator-workflows.md` when a concept, diffuse texture, sign, decal, or source image would help.

**Required companion skill:** use `asset-search` for online asset discovery and license checking. Its source order and license policy are authoritative; this skill owns preparation and integration after a candidate is chosen.

## Project truth

- Model files: `public/models/<asset>/...`
- Attribution: `public/models/CREDITS.md`
- Curated source index: `docs/ASSETS.md`
- Registry: `src/engine/models.ts`, constant `MODEL_REGISTRY`
- Placement: `src/engine/scene.json`, a node with a `model` component
- Runtime loader and material conversion: `src/engine/render.tsx`
- Supported sources: glTF through `useGLTF`; FBX through `useFBX` plus an explicit base-color texture
- Runtime look: custom gamma-space PS2 shader, diffuse plus optional emissive only
- Texture target: longest edge at most 256 pixels unless a measured exception is approved

The source asset may contain PBR maps, but DEADWATER discards normal, metallic, roughness, and AO inputs after load. Do not describe the shipping renderer as PBR.

## Workflow

### 1. Define the job

Write down the asset's scene role, target dimensions in meters, viewing distance, silhouette, movable/static status, hollow/solid collision need, split behavior, and license requirement. Prefer a small family of reusable props over one isolated novelty.

### 2. Search in project order

1. Reuse or adapt an existing registered asset.
2. Search Poly Haven for realistic CC0 props.
3. Search the vetted itch.io packs in `docs/ASSETS.md`.
4. Search Kenney, Quaternius, OpenGameArt, or other approved sources.
5. Use custom modeling or optional AI generation only when search cannot meet the brief.

Prefer CC0. Accept CC BY only with exact attribution. Reject NC and ND licenses. Never purchase or accept a custom license without user approval.

### 3. Record provenance before download

Capture asset name, creator, source page, direct file URL if stable, license, license URL, required credit text, and retrieval date. For a new source, update `docs/ASSETS.md` as part of the asset task. For every shipped CC BY asset, update `public/models/CREDITS.md`.

### 4. Download and inspect

Keep the source folder structure under `public/models/<asset>/`. Inspect the model before placing it:

```bash
python3 .agents/skills/deadwater-3d-asset-pipeline/scripts/deadwater_3d_asset.py inspect \
  public/models/<asset>/<asset>.gltf

python3 .agents/skills/deadwater-3d-asset-pipeline/scripts/deadwater_3d_asset.py audit-project .
```

Report file size, scene/node/mesh/primitive/material counts, estimated triangles, textures and dimensions, skins, animation clips, external URI failures, bounds where available, and PBR channels the runtime will ignore.

### 5. Prepare geometry and textures

- Prefer glTF for new static assets. Keep FBX when conversion would lose data or the vetted pack already works.
- Convert with Blender headless or another deterministic local converter. Save the command or `.blend` source when conversion is not reproducible from the download.
- Normalize axes and units. DEADWATER treats one world unit as one meter.
- Put the useful object origin at floor center for props, hinge for doors, or the intended grasp/rotation point.
- Apply transforms before export when safe.
- Remove hidden meshes and accidental cameras/lights.
- Reduce all runtime texture images to 256 pixels on the longest edge.
- Require a base-color texture when the authored material color matters. `applyPS2Materials()` does not preserve glTF base-color factors.
- Preserve an emissive map only when the game needs authored glowing texels.
- Strip unused PBR material references from the runtime glTF when doing so does not break the asset. Keep an untouched source archive outside the runtime path when needed.

Use `deadwater_3d_asset.py textures` for a dry run, then add `--write` only after reviewing the list. Use `strip-pbr` with a distinct output path.

### 6. Register

Add one canonical entry to `MODEL_REGISTRY`:

```ts
assetKey: { source: 'gltf', url: '/models/asset/asset.gltf' }
```

For FBX:

```ts
assetKey: {
  source: 'fbx',
  url: '/models/pack/Asset/Asset.fbx',
  texture: '/models/pack/Asset/Asset_Base_Color.png',
}
```

Do not add a second loader path for one asset.

### 7. Place through scene data

Add a node to `src/engine/scene.json` with transform, model component, and deliberate physics component. Use `split: "mesh"` or `split: "suffix-ab"` only after inspecting mesh names and confirming each piece should become a separate body.

Choose collision from gameplay need:

- `cuboid` for simple blockout and stable piles;
- `hull` for movable solid props;
- `trimesh` for static concave or hollow shapes;
- `none` plus `blockPlayer` only when the custom player path needs a boundary without Rapier collision.

Test both Rapier behavior and the custom player collision path where relevant.

### 8. Verify in DEADWATER

1. Run the production build.
2. Open `/editor.html`, find the model thumbnail, and inspect scale and pivot on the asset stage.
3. Place it or load the edited scene.
4. Capture the affected `__sheet()` area for coverage.
5. Use `__teleport()` and a player-height screenshot for material, fog, and silhouette.
6. Use `__testCollision()` for player boundaries.
7. Test grabbable or split bodies through the real interaction.
8. Check console and network for missing buffers, images, textures, and decoder errors.

## Optional generated assets

Use an available local or built-in generation tool only when the user requests generated geometry or licensed search cannot satisfy the brief. No provider, account, or credential is required by this skill. Record the prompt/tool as provenance, inspect the output like any downloaded model, and expect manual cleanup. Generated output never bypasses licensing review for source images, geometry budgets, pivot/scale work, or in-game verification.

## Required report

Include the brief, search candidates, selected source and license, credit change, downloaded and prepared paths, inspection summary, conversion commands, texture reductions, registry key, scene node IDs, physics/split choices, build result, editor/game artifacts, collision result, and remaining risks.
