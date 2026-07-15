# Asset Source Index

Curated sources for PS2-era assets (props, textures, environments) that fit
this project. Licenses noted per source — always re-check the license on the
specific pack page before shipping. Attribution goes in
`public/models/CREDITS.md`.

## Currently in use

| Source | License | What we use | How |
|---|---|---|---|
| [Poly Haven](https://polyhaven.com) | CC0 | All GLTF props (barrels, crates, cans, lamps, furniture, machinery) | API-scripted (recipes below) |
| [ambientCG](https://ambientcg.com) | CC0 | All tileable textures (concrete, steel, plaster, brick) | Direct zip URLs (recipes below) |
| [Wikimedia Commons](https://commons.wikimedia.org) | varies (CC BY 4.0 in use) | Trash-pile photo texture | API search + crop/downscale |

## Vetted industrial and low-poly itch.io packs

| Pack | Creator | License | Contents |
|---|---|---|---|
| [Free CC0 Industrial 3D Models](https://3dmodelscc0.itch.io/free-cc0-industrial-3d-models) | 3dmodelscc0 | CC0 | Industrial props |
| [Free CC0 3D Industrial Props Pack #2](https://3dmodelscc0.itch.io/free-cc0-3d-industrial-props-pack-2) | 3dmodelscc0 | CC0 | 9 industrial props |
| [Free CC0 City Environment Pack #2](https://3dmodelscc0.itch.io/free-cc0-city-environment-pack-2) | 3dmodelscc0 | CC0 | City/street environment pieces |

Creator page worth trawling: [3dmodelscc0](https://itch.io/profile/3dmodelscc0)
(everything CC0).

## Discovery searches (itch.io tag URLs)

- https://itch.io/game-assets/tag-3d/tag-industrial — industrial 3D
- https://itch.io/game-assets/free/tag-3d/tag-cc0 — free 3D + CC0
- https://itch.io/game-assets/free/tag-3d/tag-low-poly — free low-poly 3D
- https://itch.io/game-assets/free/tag-3d/tag-horror — free horror 3D

## Other standing sources

- [Kenney.nl](https://kenney.nl/assets) — everything CC0; low-poly kits (city, furniture, weapons)
- [Quaternius](https://quaternius.com) — CC0 low-poly model packs
- [OpenGameArt](https://opengameart.org) — filter by CC0; quality varies

## Download recipes

Poly Haven model (1k GLTF + textures):

```sh
slug=barrel_03
curl -s -A "Mozilla/5.0" "https://api.polyhaven.com/files/$slug" | python3 -c "
import json,sys,os
d=json.load(sys.stdin)
g=d['gltf']['1k']['gltf']
for u,rel in [(g['url'], os.path.basename(g['url']))] + [(i['url'],r) for r,i in g.get('include',{}).items()]:
    print(u+'\t'+rel)"
# download each URL to public/models/$slug/<rel>, then:
find public/models/$slug -name "*.jpg" -exec sips -Z 256 {} \;
```

Poly Haven search: `https://api.polyhaven.com/assets?t=models` (filter names in python).

ambientCG texture: `https://ambientcg.com/get?file=<AssetId>_1K-JPG.zip`, unzip the
`*Color.jpg`, `sips -Z 256`.

itch.io packs: no API — download the zip in a browser (ask the user for paid
packs), unzip into `public/models/<pack>/`, convert to GLTF if needed
(fbx → use Blender headless or prefer packs that ship .glb).

## Integration checklist

1. Record source, license, and attribution in this index and
   `public/models/CREDITS.md` before shipping.
2. Reduce runtime textures to 256px on the long side (`sips -Z 256`) unless a
   measured exception is approved.
3. Register one canonical loader entry in `MODEL_REGISTRY` in
   `src/engine/models.ts`.
4. Place the asset through a `model` component in `src/engine/scene.json`;
   keep that file authoritative for world layout.
5. Add a deliberate physics component: cuboid for simple stable bodies, hull
   for movable solid props, trimesh for static concave/hollow geometry, or no
   Rapier collider with `blockPlayer` only when the custom player path needs it.
6. Verify the editor thumbnail/stage, in-game PS2 material conversion, scale,
   pivot, player collision, Rapier behavior, contact sheet, and production URL.

## CLI download tool (works)

`npx itchio-downloader --url <pack-url> --downloadDirectory <dir>` — free
packs, no API key ([repo](https://github.com/Wal33D/itchio-downloader)).
Note: some "zips" are actually RAR5 — extract with `bsdtar -xf`. FBX packs
load at runtime via FbxProp (drei useFBX + explicit base-color texture);
scale is auto-normalized (cm heuristic) with a manual `scale` prop override.
Alternative: [itch-dl](https://github.com/DragoonAethis/itch-dl) (needs API key).

## Audio

One-shots under `public/sounds/` come from Kenney's CC0 Impact Sounds and
Interface Sounds packs: concrete footsteps, landing, pickup, relay and door
clunks, crowbar impact, switch click, and torch click. Exact credits live in
`public/models/CREDITS.md`.

`src/game/audio.ts` still synthesizes the seamless interior hum and harbor
wash beds, crowbar whoosh, and rat squeak. New audio should reuse those paths
or follow `.agents/skills/deadwater-audio-generator/` for provenance,
processing, integration, and browser verification.
