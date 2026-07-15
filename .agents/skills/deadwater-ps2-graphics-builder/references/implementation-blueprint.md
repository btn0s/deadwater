# DEADWATER graphics implementation blueprint

Use this reference for broad renderer, scene-art, lighting, material, or imported-model work.

## Architectural position

DEADWATER is a data-driven React Three Fiber game with a custom shader pipeline. Do not replace that pipeline with a generic Three.js PBR stack.

- `[DEADWATER policy]` `src/engine/scene.json` is the source of truth for world composition.
- `[DEADWATER policy]` `src/engine/types.ts` defines the components an editor or agent may place.
- `[DEADWATER policy]` `src/engine/render.tsx` maps those components to runtime visuals and strips imported materials.
- `[DEADWATER policy]` `src/ps2/PS2Material.ts` owns the opaque diffuse and emissive material contract.
- `[DEADWATER policy]` `src/ps2/PS2Pipeline.tsx` owns offscreen rendering and presentation.

Keep those boundaries. A visual change belongs in scene data when it is placement or tuning, in an engine component when it is reusable scene vocabulary, and in `src/ps2/` only when it changes the renderer contract.

## Repository ownership map

| Concern | Canonical path | Change here when |
| --- | --- | --- |
| Material and light shader | `src/ps2/PS2Material.ts` | The shared diffuse/emissive, Gouraud, fog, dither, bombing, or flashlight response changes |
| Fixed render target and pass order | `src/ps2/PS2Pipeline.tsx` | A full-scene pass, target, or final blit changes |
| Flashlight shadow | `src/ps2/torchShadow.ts` | Its 512 shadow target, light camera, matrix, or uniforms change |
| Scene depth | `src/ps2/sceneDepth.ts` | Depth-consuming effects need shared camera depth |
| CCTV target and camera | `src/ps2/cctv.ts` | CCTV resolution, refresh contract, or fixed camera changes |
| Runtime component visuals | `src/engine/render.tsx` | A component needs reusable geometry or material conversion |
| Component schema | `src/engine/types.ts` and `src/engine/inspector.ts` | Scene data needs a new editable field or component |
| Model registry | `src/engine/models.ts` | A glTF or FBX asset becomes placeable |
| Texture registry | `src/engine/textures.ts` | A tileable diffuse texture becomes placeable |
| Light allocation | `src/engine/lights.ts` | Slot lifecycle or diagnostics change |
| World placement | `src/engine/scene.json` | Geometry, props, lights, environment, collisions, or instances move |
| Water | `src/game/SewerWater.tsx` | Flow, wave, foam, opacity, or water-only shading changes |
| Flashlight rig | `src/game/Flashlight.tsx` | Viewmodel, beam, aim, inventory, or torch camera pose changes |
| CCTV objects and screen | `src/game/Cctv.tsx` | Monitor/camera meshes or screen treatment change |
| Contact sheets | `src/game/DevViews.tsx` | Review coverage or named camera sets change |
| 4:3 presentation and HUD | `src/index.css` | Canvas framing or CSS overlay changes |

## Decision order

Solve a visual problem at the lowest stable layer:

1. Adjust scene placement, scale, repetition, environment, or a component field in `src/engine/scene.json`.
2. Reuse an existing model, texture, primitive, generator, instance, or light component.
3. Add a reusable engine component or procedural generator.
4. Add or adapt a diffuse asset and route it through the registries.
5. Extend the shared material only when many surfaces need the same behavior.
6. Add a full-scene pass only when no cheaper layer can produce the required read.

Every step below the scene layer raises regression and pass cost. The technical-art contract must justify steps 4 through 6.

## Scene construction contract

Use the flat node tree in `src/engine/scene.json`. Each visual node should answer:

- What gameplay or composition role does it serve?
- Which node owns its transform?
- Is it unique, repeated through `instance`, or generated?
- Does it need a separate `physics` component?
- Which contact-sheet camera proves it is placed correctly?

Preserve the warehouse layout rules in `docs/WAREHOUSE-LAYOUT.md`: clear drive and cross aisles, squared stock, rack rows on column lines, and clutter only in designated junk areas. Dense placement is not automatically better. Occlusion, traversal, and sightline quality are part of the graphics pass.

## Material flow

### Authored surfaces and primitives

`SurfaceVisual` and `PrimitiveVisual` in `src/engine/render.tsx` create `PS2Material` instances. Add only these inputs to the ordinary material path:

- raw diffuse texture;
- raw display-space tint;
- UV repeat and offset;
- optional additive emissive map;
- optional fullbright flag for deliberately unlit signal geometry;
- optional texture-bombing density for selected broad tiled surfaces.

`SurfaceVisual` tessellates planes so per-vertex lights have enough samples. Tune `segments` in the scene component when a light pool facets or misses a broad surface. Do not fix Gouraud artifacts by moving ordinary lights to the fragment shader.

### Imported glTF and FBX

Register assets in `src/engine/models.ts`, then place them with a `model` component in `src/engine/scene.json`.

`applyPS2Materials` in `src/engine/render.tsx` replaces imported glTF materials. It keeps the first source material's diffuse and emissive maps, recognizes glass by mesh or material name, disables Three.js shadow flags, and drops the PBR channels. This is the intended boundary.

Check imports for:

- scale, orientation, ground contact, pivot, and bounds;
- useful silhouette at gameplay distance;
- source material arrays that collapse incorrectly to the first material;
- mesh and material names needed by the glass heuristic;
- emissive texels that should survive as an additive map;
- textures reduced to the project's 256px working scale unless a larger source is justified;
- collision represented separately with the `physics` component;
- attribution in `public/models/CREDITS.md`.

FBX assets receive one explicit base-color texture and use the centimeter-scale heuristic in `FbxVisual`. Verify the result instead of trusting the heuristic.

## Lighting architecture

`src/ps2/PS2Material.ts` compiles a 20-entry light array into every ordinary material. `src/engine/lights.ts` allocates those slots at runtime.

- `[DEADWATER policy]` Twenty is a shader-array budget, not a PS2 hardware limit.
- `[DEADWATER policy]` Leave at least one slot for `src/game/Flashlight.tsx` in gameplay areas where it can be equipped.
- `[DEADWATER policy]` Use scene lights for shaped illumination and fullbright/emissive geometry for visible fixtures.
- `[DEADWATER policy]` Tune surface tessellation, light radius, intensity, cone, and ambient together.
- `[Modern cheat]` Only the flashlight skips the vertex loop and receives per-fragment hard shadowing.

Prefer moving or consolidating fixtures over increasing the array size. Increasing `MAX_LIGHTS` expands the loop for every vertex whether the new slots are active or not.

## Special-system ownership

### Flashlight

The flashlight uses one shared light slot for bookkeeping, but its ordinary material contribution is evaluated per fragment and compared with a one-tap hard shadow map. Keep the shadow map scoped to this light. Verify aim convergence, shadow acne, viewmodel exclusion from depth passes, and the scene with the flashlight stowed.

### Water

Water owns its own shader in `src/game/SewerWater.tsx`. It keeps per-vertex scene lighting but uses the shared opaque depth target for per-fragment intersection foam. The depth pass hides registered water and flashlight rig objects through `waterMeshes` in `src/ps2/sceneDepth.ts`.

Do not attach unrelated objects to `waterMeshes` as a general visibility system. Do not add reflection, refraction, or SSR to make the water look expensive. Improve flow, texture scale, silhouette bob, light response, and bounded foam first.

### Glass

`createGlassMaterial` in `src/engine/render.tsx` is a dirty translucent surface with a facing-ratio sheen. It is a modern cheat, not `MeshPhysicalMaterial`. Keep it rare, sort-aware, and `depthWrite: false`. Verify the geometry behind it remains legible.

### CCTV

The CCTV feed renders at 128x96 every 0.25 seconds. It is a deliberate low-resolution, low-rate insert. Keep the camera coverage, temporary yard visibility override, monitor readability, and extra renders measurable.

### CRT presentation

The final blit adds line darkening and corner falloff, then the CSS viewport presents 4:3. This is the final-frame contract. Contact sheets do not execute this blit and cannot prove it.

## Implementation sequence

1. Capture the affected live view and contact-sheet tiles.
2. State the visible defect and its owner path.
3. Record the claim label and technical-art budget impact.
4. Change scene data or reuse existing vocabulary first.
5. Add reusable geometry or diffuse assets only when scene edits are insufficient.
6. Change the shared material or pass graph last.
7. Verify darkness, ordinary lights, flashlight, fog, dither, texture filtering, affected cheats, and collision.
8. Re-capture the same evidence and score it.

## Architectural rejection list

Reject a change that:

- introduces stock PBR materials or an environment map into shipped world rendering;
- adds PSX vertex snapping, affine wobble, or nearest-only pixelation as a global effect;
- treats 512x448 or 20 lights as universal PS2 limits;
- hides flat composition behind fog, darkness, bloom, or noise;
- adds a shader without a label, owner, cost, and comparison capture;
- edits generated contact-sheet PNGs as if they were source assets;
- bypasses `src/engine/scene.json` with hard-coded one-off world placement;
- reports direct contact sheets as proof of final CRT presentation.
