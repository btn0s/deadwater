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

### Cardboard cargo textures

| Assets | Source | License | Runtime use | Retrieved |
|---|---|---|---|---|
| Cardboard002, Cardboard004 | [ambientCG](https://ambientcg.com/view?id=Cardboard002), [variant](https://ambientcg.com/view?id=Cardboard004) | [CC0](https://docs.ambientcg.com/license/) | Color maps downscaled from `1K-JPG` to 256px JPEG for cargo cartons | 2026-07-14 |

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

Runtime audio under `public/sounds/` is built from isolated CC0 recordings.
The untouched archives and extracted sources live in the ignored
`.cache/deadwater-audio/` production directory. Retrieval date: 2026-07-14.

| Source | Author | License | Original archive | SHA-256 |
| --- | --- | --- | --- | --- |
| [Sound Effects Pack](https://opengameart.org/content/sound-effects-pack) | OwlishMedia | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `Owlish Media Sound Effects.zip` | `57d7059fe2c0ea5f47c7554ace22a538ea22ab40bfc0906b71aa259afffd3d18` |
| [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2) | rubberduck | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `sfx_100_v2.zip` | `0fc61b4494e2e893c0c015ced4877b3f689c7d84a48cb61daecd7ddb52db797b` |
| [Metal footsteps on concrete](https://opengameart.org/content/metal-footsteps-on-concrete) | Thimras | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `metal_steps_48k24b.7z` | `3df6f81f669dd2f5bf83b8dab46cd0942bd86e7d33cc4409f1ba8470a9df488d` |
| [The Shop](https://opengameart.org/content/the-shop) | LEGIT Audio | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `legit_audio_-_the_shop_free_sfx_wav.zip` | `87d49c4431fdf5647f3c434455b3bcd402fc757f97f2640b2ef84e2e5db9d86e` |
| [Squeaky Rat](https://opengameart.org/content/squeaky-rat) | Iwan "qubodup" Gabovitch | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `qubodupSqueakyRat.7z` | `966649ba0e136ec2d473623e15d11710b7fcc8f73a30897758453e8d43bb75a7` |

Run `npm run audio:build` to regenerate the shipping files. The deterministic
recipe in `scripts/build-deadwater-audio.mjs` records every source file,
source hash, trim, processing profile, and FFmpeg command in
`.cache/deadwater-audio/production-record.json`. It trims and fades one-shots,
applies family-specific filtering and dynamics, level-matches variants, and
encodes 44.1 kHz OGG Vorbis at quality 5.

Run `npm run audio:stage-candidates`, `npm run audio:audition`, and
`npm run dev`, then open `/audio-audition.html` to compare level-matched source
candidates. `npm run test:audio` validates licenses, catalog bounds, minimum
variant counts, shipped paths, acoustic surface rules, and zone selection.

`src/game/audio.ts` owns the only `AudioContext`, five mix buses, decoding,
voice limits, HRTF world playback, listener tracking, guarded stingers, and
crossfaded warehouse, sewer, and harbor beds. Acoustic materials, floor types,
and sparse environmental emitters live in `src/engine/scene.json`.
