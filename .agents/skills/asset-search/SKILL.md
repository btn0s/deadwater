---
name: asset-search
description: Find and license-check 3D props, tileable textures, and photo textures for DEADWATER. Use for asset discovery; route model preparation, registration, placement, collision, and verification through deadwater-3d-asset-pipeline.
---

# DEADWATER asset search

The curated source index lives in `docs/ASSETS.md` — check it first and keep
it updated when you vet a new pack or source.

## Search order

1. **Poly Haven** (CC0, scripted) — best for realistic props/furniture.
   Search: `curl -s -A "Mozilla/5.0" "https://api.polyhaven.com/assets?t=models"`
   then filter keys/names by keyword in python. Textures: `t=textures`.
2. **ambientCG** (CC0, scripted) — tileable material textures.
   Direct zip: `https://ambientcg.com/get?file=<AssetId>_1K-JPG.zip`.
3. **Vetted itch.io packs** — see the industrial and low-poly table in
   `docs/ASSETS.md` (the 3dmodelscc0 industrial packs are CC0).
4. **itch.io discovery** — WebSearch/WebFetch the tag URLs in `docs/ASSETS.md`
   (`tag-industrial`, `tag-low-poly`, `free/tag-3d/tag-cc0`). itch has no
   download API: free direct files sometimes work with curl; otherwise ask the
   user to download the zip in a browser and give you the path.
5. **Wikimedia Commons** (photo textures) — API search with license metadata:
   `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<terms>&gsrnamespace=6&prop=imageinfo&iiprop=url%7Cextmetadata&format=json`
6. **Kenney / Quaternius / OpenGameArt** — CC0 fallbacks for stylized kits.

## License policy

- Prefer CC0. CC BY is fine — attribution goes in `public/models/CREDITS.md`.
- No NC/ND licenses. Paid packs: surface to the user, never purchase.
- Re-check the license on the specific pack page, not the creator's general
  claim; record it in `docs/ASSETS.md` when adding a source.

## Discovery handoff

1. Poly Haven GLTF recipe (exact commands): see `docs/ASSETS.md` § Download
   recipes. Always use a `Mozilla/5.0` user-agent — default curl/python UAs
   get 403s.
2. Record title, author, source page, direct file/archive name, license and
   version, license URL, required credit, and retrieval date before download.
3. Load `deadwater-3d-asset-pipeline/SKILL.md` for models and model textures.
   That skill owns inspection, conversion, 256px runtime preparation,
   `MODEL_REGISTRY` in `src/engine/models.ts`, `scene.json` placement,
   PS2-material conversion, collision, editor checks, and game verification.
4. Load `deadwater-image-generator/SKILL.md` for standalone world textures,
   signs, decals, emissive masks, or image edits.
5. Update `public/models/CREDITS.md` and, if the source is new,
   `docs/ASSETS.md`.

## Fit guide (this project)

Gritty PS2-style warehouse/sewer: industrial, worn, low-poly, muted palettes.
Good: crates, drums, pipes, machinery, signage, pallets, lockers, tools.
Wrong vibe: clean modern furniture, stylized-cute sets, or source art whose
form disappears after diffuse/emissive conversion. High source polygon count
is not automatically disqualifying, but the shipped silhouette, texture size,
draw cost, and collision must pass the DEADWATER pipeline.
