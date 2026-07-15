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

## Vetted itch.io packs (PS1/PS2 style)

| Pack | Creator | License | Contents |
|---|---|---|---|
| [PSX Industrial Environment Asset Pack](https://godgoldfear.itch.io/psx-industrial-environment-asset-pack) | godgoldfear | CC BY 4.0 | Industrial models, fbx/glb + textures w/ normals — strongest fit for this project |
| [Free CC0 Industrial 3D Models](https://3dmodelscc0.itch.io/free-cc0-industrial-3d-models) | 3dmodelscc0 | CC0 | Industrial props |
| [Free CC0 3D Industrial Props Pack #2](https://3dmodelscc0.itch.io/free-cc0-3d-industrial-props-pack-2) | 3dmodelscc0 | CC0 | 9 industrial props |
| [Free CC0 City Environment Pack #2](https://3dmodelscc0.itch.io/free-cc0-city-environment-pack-2) | 3dmodelscc0 | CC0 | City/street environment pieces |
| [Paquete de modelos low poly estilo PSX](https://elbolilloduro.itch.io/objetos-low-poly-estilo-psx) | Elbolilloduro | CC0 | PSX-style object grab-bag; creator has more CC0 packs (house, characters) |
| [PSX Mega Pack](https://pizzadoggy.itch.io/psx-mega-pack) | Pizza Doggy | paid (~€10), own license | Huge: props, pickups, tools, weapons; Mega Pack II adds modular interiors/exteriors |
| [100 PSX Mega House Pack](https://postdev.itch.io/100-psx-mega-house-pack) | postdev | check page | 100 house/interior models |

Creator pages worth trawling: [3dmodelscc0](https://itch.io/profile/3dmodelscc0) (everything CC0),
[Elbolilloduro](https://elbolilloduro.itch.io) (CC0 PSX packs).

## Curated collections (indexes of indexes)

- [Miziziziz/Retro3DGraphicsCollection](https://github.com/Miziziziz/Retro3DGraphicsCollection)
  — commercially usable PS1-style assets by category: urban kit (100 models),
  industrial buildings, furniture, vehicles, weapons, barrels/crates/barriers,
  office & plumbing props. All CC0-or-equivalent, hosted on itch/OpenGameArt.

## Discovery searches (itch.io tag URLs)

- https://itch.io/game-assets/free/tag-3d/tag-psx — free 3D + PSX
- https://itch.io/game-assets/free/tag-horror/tag-psx — horror + PSX
- https://itch.io/game-assets/tag-3d/tag-industrial — industrial 3D
- https://itch.io/game-assets/free/tag-3d/tag-cc0 — free 3D + CC0
- https://itch.io/game-assets/tag-ps1 / tag-psx / tag-retro — general era tags

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

1. Textures to 256px (`sips -Z 256`) — PS2 budget.
2. Register in `MODELS` map in `src/game/Prop.tsx`.
3. Place with `<Prop>` (single) or `<SplitProp>` (multi-piece, per-piece grab).
4. Flags: `grabbable` for junk, `physics="trimesh"` for hollow containers,
   `physics="none"` for ceiling-mounted decor, `collide` for player-blocking.
5. Add attribution to `public/models/CREDITS.md` (required for CC BY).

## CLI download tool (works)

`npx itchio-downloader --url <pack-url> --downloadDirectory <dir>` — free
packs, no API key ([repo](https://github.com/Wal33D/itchio-downloader)).
Note: some "zips" are actually RAR5 — extract with `bsdtar -xf`. FBX packs
load at runtime via FbxProp (drei useFBX + explicit base-color texture);
scale is auto-normalized (cm heuristic) with a manual `scale` prop override.
Alternative: [itch-dl](https://github.com/DragoonAethis/itch-dl) (needs API key).

## Audio

All sound is **synthesized in-engine** (`src/game/audio.ts`): filtered-noise
foley (clicks, clunks, whooshes, thunks, footsteps), FM rat chirps, and
looped noise beds for ambience (interior hum / harbor wash). No sample
files, no licenses. To swap in sourced samples later, replace the baked
AudioBuffers — good CC0 sources: Kenney (kenney.nl/assets, audio packs),
OpenGameArt (CC0 filter), Sonniss GDC bundles (royalty-free).
