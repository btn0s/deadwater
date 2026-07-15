# Model and set-piece quality checklist

Gate imported assets, primitive assemblies, generators, prop families, and set pieces.

- [ ] The asset or set piece has a clear gameplay, composition, or environmental role.
- [ ] Its silhouette reads in the first-person gameplay camera at 512x448.
- [ ] Fine detail survives the intended camera distance and ordered dither.
- [ ] Vertex density improves silhouette or per-vertex light interpolation.
- [ ] Normals and smoothing produce intentional Gouraud gradients.
- [ ] Visual geometry and collision are separate where their needs differ.
- [ ] Scale, pivot, orientation, bounds, and ground contact are verified.
- [ ] Existing assets in `src/engine/models.ts` were considered before adding a new source.
- [ ] Imported assets pass through `applyPS2Materials` in `src/engine/render.tsx`.
- [ ] Diffuse and justified emissive maps survive conversion; PBR channels do not.
- [ ] Source material arrays and first-material collapse were inspected.
- [ ] Glass mesh/material names trigger only the intended conversion path.
- [ ] Source and shipped texture dimensions follow the 256px default or document an exception.
- [ ] License and `public/models/CREDITS.md` status are recorded.
- [ ] FBX centimeter normalization or glTF real-world scale is verified in scene.
- [ ] Repeated construction uses instances, shared resources, or a deterministic generator when appropriate.
- [ ] Warehouse stock follows `docs/WAREHOUSE-LAYOUT.md` instead of random scattering.
- [ ] Navigation, sightlines, interaction, and negative space remain intact.
- [ ] The model reads under darkness, ordinary lights, fog, and flashlight.
- [ ] Diagnostics include mesh/material/triangle counts, texture use, collision, reuse plan, and live/contact-sheet evidence.
