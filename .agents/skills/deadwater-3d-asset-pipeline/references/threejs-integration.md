# DEADWATER model integration

## Runtime paths

`SceneRoot` reads `src/engine/scene.json`. `NodeView` sends model components to `GltfVisual`, `FbxVisual`, or `SplitModel` in `src/engine/render.tsx`.

- glTF loads with `useGLTF`, clones the scene, and calls `applyPS2Materials()`.
- FBX loads with `useFBX`, loads one explicit base-color texture, applies a 0.01 scale heuristic to centimeter-scale assets, grounds the lowest bound at Y=0, and gives all meshes one PS2 material.
- Split glTF models clone and convert materials before grouping meshes into separate containers.
- Every registered glTF is preloaded at module evaluation.

## Registry

Add a stable camel-case key to `MODEL_REGISTRY` in `src/engine/models.ts`.

```ts
valveWheel: {
  source: 'gltf',
  url: '/models/valve_wheel/valve_wheel.gltf',
},
```

FBX requires an explicit texture:

```ts
workBench: {
  source: 'fbx',
  url: '/models/industrial-pack/WorkBench/WorkBench.fbx',
  texture: '/models/industrial-pack/WorkBench/WorkBench_Base_Color.png',
},
```

Use root-relative public URLs. Keep one registry entry per canonical asset.

## Scene node

```json
{
  "id": "dock/valve-wheel-1",
  "parent": "dock",
  "transform": { "pos": [12.5, 0, -3.2], "rot": 1.57 },
  "components": [
    { "type": "model", "source": "gltf", "url": "/models/valve_wheel/valve_wheel.gltf" },
    { "type": "physics", "body": "fixed", "collider": "hull", "blockPlayer": true }
  ]
}
```

`scene.json` stores the source fields, not the registry key. Copy the registry's values exactly. The registry drives editor palettes and preload; the scene component drives runtime placement.

## Split models

- `split: "mesh"` makes each named mesh its own piece.
- `split: "suffix-ab"` groups names ending in `_a` and `_b`.

Use split only for pieces that should simulate independently. Inspect node and mesh names before choosing. Each dynamic split piece needs a sensible local center after the renderer recenters it.

## Material conversion

The loader creates modern glTF materials only long enough to extract diffuse and emissive textures. `applyPS2Materials()` then replaces them. It does not preserve PBR properties, source color factors, alpha modes, sidedness, or material arrays.

Check these cases:

- all important color is baked into the diffuse texture;
- untextured colored meshes do not turn white;
- multi-material primitives do not collapse incorrectly;
- intended lamp glass has `glass` in mesh or material name;
- non-lamp glass does not accidentally become fullbright;
- emissive images contain only intended glowing texels;
- every texture is prepared for raw gamma-space sampling and 256px runtime use.

## Scale, bounds, and pivot

Use editor asset stage and in-game context. Compare against a player eye height of roughly 1.65 meters and nearby known props. A model can look plausible in isolation while being unusable in the level.

Check:

- lowest bound meets the intended floor or support;
- origin supports rotation and physics;
- local scale remains close to 1 after preparation;
- grabbable center of mass and collider align with visible mass;
- distant culling and zone visibility do not hide it early;
- nested transforms do not double-apply scale.

## Verification sequence

1. Run `deadwater_3d_asset.py inspect` and `audit-project`.
2. Run `npm run build`.
3. Open the editor asset tab and wait for its thumbnail.
4. Inspect the asset on stage, then place or load the scene node.
5. Capture the affected contact sheet.
6. Teleport to a player-height view and inspect the shipping material.
7. Probe custom player collision and test Rapier behavior.
8. Check network and console for missing relative URIs and loader errors.
9. Confirm credits and source-index changes.

## Common failures

- Registering a model without adding its scene component or vice versa.
- Shipping 1K or 4K source images because the filename still says `1k`.
- Counting PBR maps as visual value even though runtime discards them.
- Relying on a glTF color factor that material replacement drops.
- Using a dynamic trimesh for a movable prop.
- Accepting the FBX scale heuristic instead of checking meters.
- Reviewing only the editor, whose renderer differs from the game pipeline.
