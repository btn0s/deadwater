# DEADWATER material and lighting checklist

Gate changes to ordinary materials, lights, fog, darkness, glass, emissive surfaces, and texture scale.

- [ ] Ordinary materials use `createPS2Material` from `src/ps2/PS2Material.ts` unless an approved cheat is named.
- [ ] Colors use raw display-space helpers and color textures use `THREE.NoColorSpace` through `prepTexture`.
- [ ] The shipped material inputs are diffuse and optional emissive only.
- [ ] No runtime PBR property or environment reflection was added.
- [ ] Bilinear magnification, hard mip transitions, and anisotropy 1 remain visible and intentional.
- [ ] Diffuse sources use the default 256px working scale unless a larger map has a documented camera-distance reason.
- [ ] UV repeat and world scale are correct before texture bombing is considered.
- [ ] Texture bombing has a same-view off/on comparison and is not used on text, signs, bricks, or directional features that ghost.
- [ ] Large receiving surfaces have enough local vertices for readable Gouraud light interpolation.
- [ ] Normals, surface rotation, light radius, intensity, cone, ambient, and fog were checked before raising tessellation.
- [ ] Visible fixtures pair light spill with emissive or fullbright source geometry.
- [ ] Fullbright is limited to authored signals and lit faces.
- [ ] The flashlight reserve remains available in the 20-slot project budget.
- [ ] `window.__lightSlots()` shows correct acquire and release behavior.
- [ ] Circuit-off, circuit-on, flashlight-stowed, and flashlight-equipped states remain readable.
- [ ] Fog joins depth without hiding missing geometry or collapsing essential values into 5-bit steps.
- [ ] Dirty glass keeps geometry behind it legible and does not create excessive transparent layers.
- [ ] Core opaque materials retain fog, ordered dither, and quantization.
- [ ] Same-view live captures and affected contact-sheet tiles show the improvement.
- [ ] Renderer and frame-time deltas are reported.
