# DEADWATER model and set-piece recipes

Use these recipes for imported props, procedural assemblies, scene-density passes, and collision-aware visual work. The goal is readable PS2-style geometry inside DEADWATER's 512x448, per-vertex-lit renderer.

## Model principles

- `[DEADWATER policy]` Judge models through the gameplay camera after runtime material conversion.
- Spend polygons on silhouette, openings, handles, bent sheet metal, cables, rails, and vertex-lighting gradients that survive 512x448.
- Remove tiny bevels, dense hidden undersides, and texture detail that collapses into dither noise.
- Keep normals intentional. Gouraud lighting exposes inconsistent smoothing immediately.
- Separate visual mesh from `physics` collision data in `src/engine/scene.json`.
- Reuse registry assets and `instance` nodes before adding copies with independent ownership.
- Use squared warehouse placement rules from `docs/WAREHOUSE-LAYOUT.md`; random rotation is reserved for designated junk piles.

Low polygon count alone does not make a model PS2-style. Do not add PSX vertex snapping, affine wobble, or nearest filtering to compensate for weak modeling.

## Imported prop recipe

1. Check the specific asset license and add attribution to `public/models/CREDITS.md` when required.
2. Place source files under `public/models/` and downscale used diffuse/emissive textures to the project's default 256px working size.
3. Add a stable key to `MODEL_REGISTRY` in `src/engine/models.ts`.
4. Add a `model` component to `src/engine/scene.json` or a library subtree used through `instance`.
5. Let `GltfVisual` or `FbxVisual` in `src/engine/render.tsx` replace source materials.
6. Add a separate `physics` component when the prop blocks, carries, or collides.
7. Verify the model in the editor thumbnail, gameplay view, contact sheet, darkness, and flashlight.

For glTF, inspect every source material before conversion. `applyPS2Materials` currently takes the first material from a material array for each mesh, preserves its diffuse and emissive maps, and discards PBR properties. If that collapses distinct visible regions, split the mesh or adapt the conversion boundary. Do not keep PBR as a shortcut.

For FBX, verify the single explicit base-color texture and the centimeter-scale heuristic. The loader grounds the cloned object after scaling, but awkward pivots or nested transforms still need inspection.

## Diffuse adaptation recipe

Imported source art often includes base color, ARM, normal, specular, or emissive textures.

- Keep the diffuse/base-color texture.
- Keep emissive only for authored bulbs, screens, labels, or hot elements.
- Drop roughness, metalness, AO, normal, specular, clearcoat, and transmission at runtime.
- Bake only useful broad cues into diffuse. Avoid baked highlights that contradict a moving flashlight.
- Increase value separation between adjacent parts when dither merges them.
- Test hard mip transitions at grazing angles and while walking.
- Use `prepTexture` so the import follows raw sampling and filtering policy.

This is a DEADWATER conversion policy, not a claim that PlayStation 2 assets never used more elaborate material or texture techniques.

## Glass and emissive naming

`applyPS2Materials` recognizes glass when the mesh name or source material name contains `glass`.

- Name only actual glass submeshes with that token.
- Confirm lamp bulb glass should become the fullbright diffuser path. Generic windows and scene `surface` glass use `createGlassMaterial` instead.
- Keep emissive pixels in a separate emissive map if the housing must remain vertex-lit.
- Verify circuit-controlled fixture glow through the `lampGlass` tag.
- Check that fullbright pieces do not illuminate the world by themselves. Pair them with a light component when light spill is required.

## Primitive assembly recipe

Use `primitive` components for structural or mechanical forms that fit the existing box, cylinder, torus, and plane vocabulary.

Good uses:

- dock bumpers, curbs, beams, pipe sections, bollards, valves, rails, brackets, and fixture housings;
- broad forms that benefit from shared `PS2Material` behavior;
- collision-aligned architecture with simple dimensions;
- small supporting pieces attached to a more distinctive imported or generated set piece.

Build assemblies as parented scene nodes with meaningful names. Keep the primary silhouette readable without texture. Use fullbright only for a lit face or signal.

Reject a prop that is a default primitive with a noisy texture and no functional structure. Add a readable profile, opening, offset, support, handle, wheel, cable, panel break, or attachment point.

## Procedural generator recipe

Current reusable generators live in `GeneratorVisual` in `src/engine/render.tsx` and are declared in `src/engine/types.ts`:

- `rack` for warehouse shelving;
- `railing` for repeated guard structure;
- `trashPile` for seeded junk mounds;
- `paperWad` for tiny seeded debris.

Add a generator when many scene nodes need the same authored construction with small parameter changes. A generator must:

- use a deterministic seed when randomness affects geometry;
- share geometry and materials where practical;
- expose only parameters the editor and scene data need;
- return predictable bounds for placement and collision;
- remain legible in its target contact-sheet tile;
- avoid material or geometry creation every frame;
- dispose resources it uniquely owns.

Do not add a generator for one prop that an imported model or a short primitive assembly handles more clearly.

## Surface topology recipe

Large planes receive Gouraud lights through their vertices. `SurfaceVisual` defaults segment counts from world width and height, while box primitives add vertical subdivisions.

- Increase `segments` locally when a light pool facets or misses the middle of a broad wall or floor.
- Keep approximately even world-space triangles near important fixtures.
- Reduce segments on distant, uniformly lit, or hidden surfaces.
- Split a wall at architectural boundaries when light and material roles differ.
- Inspect vertex normals and mesh rotation before blaming segment count.

Do not make the whole level high-density. Every extra vertex loops through the fixed 20-slot light array.

## Warehouse prop family recipe

A warehouse area reads as authored when the structural and operational roles agree.

Build or reuse a restrained family:

- storage: pallet, crate, box, can, jerrycan, barrel, cabinet, locker;
- handling: pallet truck, trolley, cable drum, jack, platform, rack;
- safety: fire extinguisher, caution sign, guard rail, lane mark, switch, light fixture;
- maintenance: compressor, generator, toolbox, oil tin, gas cylinder, work light;
- waste: trash bag, rusted can, paper, seeded pile;
- office: desk, chair, binder, cabinet, CCTV monitor, window grime;
- sewer: pump body, pipe, valve, railing, bridge, grate, debris, water boundary.

Use `src/engine/models.ts` before sourcing a new asset. Place stock in operational grids and rows. Keep the drive aisle, cross aisle, and dock apron legible.

## First-person interaction prop recipe

For a pickup, carried item, or grabbable:

- provide a silhouette that reads at arm's length and on the floor;
- keep the pivot stable under carrying and throwing;
- use a simple convex or cuboid collision proxy where possible;
- enable CCD only when the game physics needs it;
- verify prompt, pickup, carry, drop, collision, and flashlight response;
- keep emissive or fullbright feedback distinct from the crosshair and HUD;
- inspect split meshes if pieces simulate independently.

Visual mesh complexity must not leak into player collision or make a small item impossible to grab.

## Set-piece recipe

For a pump station, office, dock bay, rack row, or sewer bridge:

1. Establish the navigable negative space in `src/engine/scene.json`.
2. Place large structural forms and collision.
3. Add one functional focal object.
4. Add a small family of supporting props with shared orientation and scale.
5. Place visible light sources, then tune per-vertex light coverage.
6. Add surface detail through diffuse textures, repeat, tint, and limited bombing.
7. Add a bounded cheat only when the focal read needs glass, water foam, CCTV, or flashlight shadow.
8. Verify every relevant player path and contact-sheet camera.

Do not fill empty space uniformly. Leave traversal lanes and value-rest areas so props, signals, and hazards remain readable.

## Model diagnostics

Report per new or substantially changed asset:

- registry key and source path;
- license status;
- source and shipped texture dimensions;
- mesh, source material, converted material, and approximate triangle counts;
- bounds, scale, pivot, and orientation;
- diffuse/emissive maps kept and PBR maps stripped;
- collision proxy;
- instancing or reuse plan;
- gameplay and contact-sheet evidence;
- draw, geometry, texture, and frame-time delta when measurable.

Reject completion if the proof is only an isolated model viewer, editor thumbnail, or source PBR render.
