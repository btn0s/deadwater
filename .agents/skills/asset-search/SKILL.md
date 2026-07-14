---
name: asset-search
description: Find, license-check, download, and integrate PS2-era game assets (3D props, tileable textures, photo textures) for this project. Use when the user asks for new models, textures, furniture, machinery, environment pieces, or "find an asset for X".
---

# Asset Search & Integration

The curated source index lives in `docs/ASSETS.md` — check it first and keep
it updated when you vet a new pack or source.

## Search order

1. **Poly Haven** (CC0, scripted) — best for realistic props/furniture.
   Search: `curl -s -A "Mozilla/5.0" "https://api.polyhaven.com/assets?t=models"`
   then filter keys/names by keyword in python. Textures: `t=textures`.
2. **ambientCG** (CC0, scripted) — tileable material textures.
   Direct zip: `https://ambientcg.com/get?file=<AssetId>_1K-JPG.zip`.
3. **Vetted itch.io packs** — see the table in `docs/ASSETS.md`
   (3dmodelscc0 = CC0 industrial; godgoldfear PSX Industrial = CC BY 4.0;
   Elbolilloduro = CC0 PSX).
4. **itch.io discovery** — WebSearch/WebFetch the tag URLs in `docs/ASSETS.md`
   (`tag-psx`, `tag-industrial`, `free/tag-3d/tag-cc0`). itch has no download
   API: free direct files sometimes work with curl; otherwise ask the user to
   download the zip in a browser and give you the path.
5. **Wikimedia Commons** (photo textures) — API search with license metadata:
   `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<terms>&gsrnamespace=6&prop=imageinfo&iiprop=url%7Cextmetadata&format=json`
6. **Kenney / Quaternius / OpenGameArt** — CC0 fallbacks for stylized kits.

## License policy

- Prefer CC0. CC BY is fine — attribution goes in `public/models/CREDITS.md`.
- No NC/ND licenses. Paid packs: surface to the user, never purchase.
- Re-check the license on the specific pack page, not the creator's general
  claim; record it in `docs/ASSETS.md` when adding a source.

## Download & integration pipeline

1. Poly Haven GLTF recipe (exact commands): see `docs/ASSETS.md` § Download
   recipes. Always use a `Mozilla/5.0` user-agent — default curl/python UAs
   get 403s.
2. Downscale every texture to 256px: `sips -Z 256 <file>` (PS2 budget; the
   material pipeline expects low-res).
3. Register the model in the `MODELS` map in `src/game/Prop.tsx`.
4. Place it:
   - `<Prop url={MODELS.x} position rotationY grabbable />` — single-piece.
   - `<SplitProp url groupBy />` — multi-mesh models that should split into
     independently grabbable pieces (check node names in the .gltf JSON).
   - Flags: `physics="trimesh"` for hollow containers (trash cans),
     `physics="none"` for ceiling decor, `collide={false}` for small junk.
5. Sanity-check scale in-scene (Poly Haven is real-world scale; itch packs
   often are not — wrap in a group scale or pass `scale`).
6. Verify visually with `window.__sheet()` (writes contact-sheet*.png to the
   project root) or a targeted `window.__teleport(x, z, yaw)` + screenshot.
7. Update `public/models/CREDITS.md` and, if the source is new, `docs/ASSETS.md`.

## Fit guide (this project)

Gritty PS2-era warehouse/sewer: industrial, worn, low-poly, muted palettes.
Good: crates, drums, pipes, machinery, signage, pallets, lockers, tools.
Wrong vibe: clean/modern furniture, stylized-cute, high-poly PBR showpieces —
if it looks like a furniture catalog, it will read "too cute" in-scene.
