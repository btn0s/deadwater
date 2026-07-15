# DEADWATER

A foundation for building **PS2-era games in three.js with agentic tools**.
The dock-warehouse level (DEADWATER) is the demo cartridge; the product is
the kit around it — a renderer, a data-driven world, an in-browser editor,
and a set of hooks that let an AI agent see, critique, edit, and verify the
game headlessly.

```sh
npm install
npm run dev          # game:   http://localhost:5173
                     # editor: http://localhost:5173/editor.html
```

In game: **WASD** move · **Shift** run · **Space** jump · **click** grab/toss
(telekinesis) · **E** open editor · **Esc** release mouse.

## The loop

Everything is built so both a human and an agent can drive it:

| Capability | Human | Agent |
|---|---|---|
| See the level | play it / open the editor | `window.__sheet()` renders labeled contact sheets to `contact-sheet*.png` |
| Move around | WASD / editor fly-cam | `window.__teleport(x, z, yaw, pitch)`, `__playerPos()` |
| Edit the world | editor gizmos + inspector, SAVE | read/patch `src/engine/scene.json` directly, or drive `window.__sceneStore` |
| Tune the look | select the `environment` node | same file, `environment` component |
| Verify | look at it | screenshots, `__testCollision`, `__lightSlots()`, contact sheets |

The critical design decision: **the level is a scene graph in data**
(`src/engine/scene.json`) — a flat table of nodes forming a tree via parent
refs, each with a transform and components (model, light, physics, surface,
primitive, generator, behavior, instance, environment). The editor's SAVE
button and an agent's file edit write the same source of truth, so visual
editing and agentic editing never fork.

## What's in the kit

**PS2 renderer** (`src/ps2/`) — `PS2Material` (Gouraud per-vertex lighting
with 20 shared light slots and shaded-fixture downward cones, diffuse-only
maps, gamma-space pipeline like the Graphics Synthesizer, linear fog, ordered
dither to 5-bit color, stochastic texture bombing, UV scroll), `PS2Pipeline`
(fixed 512×448 target, bilinear upscale, interlace + CRT falloff, 4:3
letterbox), `SewerWater` (dual opposed scrolling layers + sine vertex waves).

**Engine** (`src/engine/`) — the node/component scene model (`types.ts`),
the tree renderer (`render.tsx`: one renderer per component type, recursive
`NodeView`, `SceneRoot` with game/editor modes), runtime light-slot
allocation, texture + model registries, and the editor store (node CRUD,
reparenting, undo, prefabs, save).

**Game systems** (`src/game/`) — pointer-lock FPS controller with AABB
sliding collision; Rapier physics (grabbable hulls with ccd, trimesh
containers, kinematic player capsule that shoves debris); telekinesis
grab/carry/toss; `Rat` AI that hugs walls and avoids the player; GLTF/FBX
loading with PS2 material swap, cm-scale normalization, and per-piece grab
splitting (all driven by components).

**Editor** (`src/editor/`, its own vite entry — never ships with the game) —
Unity-style chrome: toolbar, scene-graph hierarchy (expand/collapse,
drag-to-reparent), a generic component inspector generated from the schema
in `src/engine/inspector.ts` (plus add/remove component), thumbnail asset
palette, orbit + fly cameras, translate/rotate gizmos (**W/E**), grid +
view-cube, click-to-place (shift = stamp), duplicate / delete / → prefab,
undo/redo (**⌘Z**), and an assets tab for composing library prefabs that
place as instances. SAVE writes `src/engine/scene.json` through a dev
middleware.

**Agent tooling** — `docs/ASSETS.md` (vetted CC0/CC-BY sources + scripted
download recipes), `.claude/skills/asset-search` (the search → license →
download → integrate pipeline as a skill), contact-sheet cameras per area,
dev middlewares in `vite.config.ts` (`/__sheet`, `/__scene`), console hooks
(`__sceneStore`, `__lightSlots`, `__teleport`, …).

## Era-authentic rendering choices

| PS2 hardware behavior | Implementation |
| --- | --- |
| 512×448 NTSC framebuffer, stretched to 4:3 | Fixed-size internal render target, bilinear upscale, letterboxed 4:3 viewport |
| Gouraud (per-vertex) lighting on the VU/GS | Custom `ShaderMaterial` computes point lights per vertex; walls/floor tessellated ~1m so light pools bleed across triangles |
| Dithering into a 16-bit framebuffer | 4×4 ordered Bayer dither + 5-bit-per-channel quantization applied on framebuffer write, exactly where the GS did it |
| No linear color pipeline | Whole pipeline runs in gamma space: textures sampled raw, lights specified as display values, no sRGB conversion anywhere |
| Diffuse-only materials | No normal/roughness/AO maps; 256px textures, bilinear mag filter, hard mip transitions, no anisotropy |
| Perspective-correct texturing | Deliberately **no** PS1 affine wobble or vertex snapping — the PS2 didn't have those artifacts |
| Interlaced CRT output | Faint line darkening at internal resolution + mild corner falloff in the upscale pass |
| Sparse dynamic lights | 20 shared slots, self-flickering fluorescent fixtures with telegraph-noise cadence |

No general scene shadow maps, postprocessing stack, or tone mapping. World
lights stay per-vertex; the flashlight alone uses one hard 512px depth shadow.

## Starting a new game from this

1. Keep `src/ps2/`, `src/engine/`, `src/editor/`, the vite middlewares, and
   the skills — that's the engine.
2. Replace `src/engine/scene.json` with your own nodes (keep an
   `environment` node). The whole world is data — walls, lights, physics,
   water, prefabs; there is no level code to port.
3. Register new models in `src/engine/models.ts`; the palette, thumbnails,
   and editor pick them up automatically.
4. Lay the level out in the editor (or have an agent patch `scene.json`).

## Credits

All assets CC0/CC-BY — textures from [ambientCG](https://ambientcg.com) and
[Poly Haven](https://polyhaven.com), models from Poly Haven and
[3dmodelscc0](https://itch.io/profile/3dmodelscc0) itch packs, one Wikimedia
Commons photo texture. Full list: [CREDITS.md](public/models/CREDITS.md).
