# Model preparation

## Inspection contract

Before registration, record:

- format and byte size;
- node, mesh, primitive, material, texture, image, skin, and animation counts;
- estimated triangles or a stated parser limitation;
- external URI existence;
- image dimensions and alpha needs;
- accessor bounds, then transformed world bounds in Blender or the editor;
- material names, especially glass and emissive parts;
- mesh names when split behavior is proposed;
- animation clip names, durations, tracks, and skeleton shape when animated.

`scripts/deadwater_3d_asset.py` covers glTF structure and project references. Use Blender or a trusted viewer for transformed bounds, FBX internals, skin deformation, and visual animation review.

## Coordinate and pivot conventions

- Use meters.
- Keep Y up and the asset's useful forward direction documented.
- Put static and movable props on the ground plane with origin near footprint center.
- Put hinged assets at the hinge only when runtime rotation needs it.
- Apply object scale and rotation before export when skinning and animation allow it.
- Test negative scales and mirrored transforms; avoid them in runtime scene data.
- Check bounding boxes after conversion, not only in the authoring file.

The FBX loader applies a 0.01 scale heuristic when the largest dimension exceeds 8 and then moves the lowest bound to Y=0. Treat that as compatibility behavior, not a substitute for correctly authored units.

## Geometry

Prioritize silhouette and broad planes. The runtime has no normal-map contribution.

- Remove hidden duplicate faces, isolated vertices, unused LODs, cameras, lights, and authoring helpers.
- Keep enough vertices for the intended silhouette and per-vertex lighting.
- Avoid dense tessellation that only supports discarded displacement or normal detail.
- Preserve separate meshes only when material identity, lamp-glass detection, animation, or split physics needs them.
- Check normals after applying transforms.
- Prefer indexed geometry when conversion preserves it.
- Use compression only after verifying loader support and browser decode behavior.

Do not set one universal triangle limit. Compare the asset with existing props at the same screen size, inspect submitted triangles in the active scene, and document the tradeoff.

## Materials and textures

`applyPS2Materials()` keeps the first source material's diffuse map and emissive map. It replaces everything else with `PS2Material` and disables ordinary mesh shadows.

Consequences:

- normal, metallic-roughness, AO, clearcoat, transmission, and environment maps do not affect the final material;
- base-color factors are not copied, so an untextured colored material becomes white;
- emissive texture survives, but authored emissive factor/intensity does not;
- material arrays collapse to their first source material;
- a mesh or material name containing `glass` becomes warm fullbright lamp glass;
- alpha mode, opacity, side, and most glTF material flags are not preserved.

Prepare the asset around those facts. Bake meaningful broad color variation into a 256px diffuse map. Split material groups into meshes if different diffuse maps must survive. Use emissive only for purposeful lit texels. Test transparency with a project-specific shader instead of expecting glTF transmission.

### Stripping unused PBR references

For `.gltf`, `deadwater_3d_asset.py strip-pbr input.gltf output.gltf` removes normal, occlusion, and metallic-roughness references from material records. It keeps diffuse and emissive references and does not overwrite the input. Inspect and load the output before changing the registry. Keep source files when re-authoring may be needed.

### Texture reduction

Run a dry audit:

```bash
python3 .agents/skills/deadwater-3d-asset-pipeline/scripts/deadwater_3d_asset.py textures public/models/<asset>
```

Then resize reviewed files:

```bash
python3 .agents/skills/deadwater-3d-asset-pipeline/scripts/deadwater_3d_asset.py textures \
  public/models/<asset> --max 256 --write
```

The command uses macOS `sips`. Retain aspect ratio. Keep PNG for alpha and JPEG or PNG for opaque source compatibility already referenced by glTF/FBX.

## FBX and conversion

Prefer an existing working FBX path when the pack supplies an explicit base-color texture. Convert when you need predictable units, pivots, mesh cleanup, animation inspection, or glTF tooling.

For Blender headless conversion, store a repeatable script or command with the asset task. Verify:

- image paths are relative and copied;
- transforms and origin survive;
- material names survive when glass detection depends on them;
- mesh names survive when split behavior depends on them;
- animations and skins survive;
- the converted glTF loads without network or decoder errors.

## Rigging and animation

AI auto-rigging is optional. Blender, Mixamo-compatible workflows with appropriate rights, or hand-authored rigs are valid. No provider is required.

- Start with a clean rest pose and separated limbs.
- Inspect skeleton hierarchy, left/right symmetry, scale, root placement, skin weights, and deformation before retargeting.
- Reject one-bone limbs, asymmetric chains, extreme scale tracks, and clips that translate limbs away from joints.
- Keep clip names stable and record duration and loop policy.
- Decide whether root motion belongs in the clip or gameplay controller.
- Test every clip on the shipped mesh in Three.js, not only in the provider preview.
- Dispose mixers and action bindings when animated instances unmount.

DEADWATER currently has no general animated-model component. Adding one is an engine feature, not an asset registration detail. Design that runtime path before shipping an animated asset.

## Collider selection

| Need | Collider |
| --- | --- |
| stable box-like blocker | cuboid |
| movable solid prop | convex hull |
| static concave or hollow object | trimesh |
| visual-only prop | none |
| custom player boundary without Rapier body | `blockPlayer` |

Avoid dynamic trimeshes. Check player AABB collision separately from Rapier collision. For grabbables, test stacking, throwing, CCD behavior, and cleanup.
