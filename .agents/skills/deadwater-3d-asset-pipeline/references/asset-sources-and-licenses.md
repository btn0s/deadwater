# Asset sources and licenses

Read the live project sources first:

- `.agents/skills/asset-search/SKILL.md` for search order and license rules.
- `docs/ASSETS.md` for vetted providers, packs, and download recipes.
- `public/models/CREDITS.md` for current attribution style.

This reference adds the evidence contract for the 3D pipeline. It does not replace those files.

## Search order

1. Existing `MODEL_REGISTRY` entries and already downloaded packs.
2. Poly Haven CC0 models through its public API.
3. Vetted industrial packs listed in `docs/ASSETS.md`.
4. Kenney and Quaternius CC0 libraries.
5. OpenGameArt with an explicit asset-level license check.
6. New itch.io discovery, Wikimedia Commons for image inputs, or another user-approved source.
7. Custom modeling or optional generated geometry.

Search for the scene role and form, not only the noun. Useful terms for DEADWATER include industrial, marine, dock, sewer, warehouse, utility, worn, corroded, cargo, maintenance, office, and low-poly.

## License policy

| License | Decision |
| --- | --- |
| CC0 | Preferred. Record source even when attribution is not required. |
| CC BY | Allowed with exact creator, title, source, license, and link in `public/models/CREDITS.md`. |
| CC BY-SA | Ask before use because share-alike obligations affect distribution. |
| NC or ND | Reject for shipped project assets. |
| Paid/custom | Ask the user to approve the license and obtain the file. Never purchase. |
| Unknown | Do not download into the shipping asset path. Keep searching. |

Check the specific asset or pack page. A creator profile saying "free" is not a license.

## Provenance record

Capture this before integration:

```text
Asset title:
Creator:
Source page:
Downloaded file URL or pack filename:
License and version:
License URL:
Required attribution text:
Retrieved date:
Local runtime path:
Edits: conversion, mesh cleanup, texture resize, material stripping
```

Generated assets also need provenance. Record the tool, prompt, date, source images, and rights assumptions for every input. Do not label generated output CC0 unless the rights holder has actually granted CC0.

## Download rules

- Use the exact Poly Haven and ambientCG recipes in `docs/ASSETS.md`.
- Preserve the original asset directory layout so relative glTF URIs resolve.
- Treat itch.io downloads as pack archives. Record the pack page and local archive name.
- Ask the user to supply manually downloaded or paid files when automation is unavailable.
- Scan archives before extraction and reject unexpected executables.
- Download to the intended asset folder only after license approval.

## Fit review

Judge fit at normal player distance in the 512x448 game image:

- silhouette reads without normal maps;
- geometry supplies the shape that PBR maps would otherwise fake;
- proportions fit one-meter world units;
- muted, worn materials survive diffuse-only lighting;
- prop density and topology suit browser rendering;
- the asset belongs in a dock, warehouse, office, sewer, or maintenance space;
- the result does not depend on glossy reflections, micro-normal detail, or a clean catalog render.

## Credits entry

Follow the current file's style. A complete CC BY entry identifies title, creator, source URL, license name/version, license URL, and local modifications. Credit the original pack even if only one model ships.

## Source-index maintenance

Update `docs/ASSETS.md` when a new source proves useful and its license has been checked. Do not add a source merely because search results looked promising. Record what DEADWATER actually used and the repeatable download method.
