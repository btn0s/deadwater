# Image workflows for 3D assets

Use `deadwater-image-generator` when a concept, diffuse texture, sign, decal, or reference sheet will reduce ambiguity. Codex's built-in image generation and editing capability is preferred when available. No external provider or API key is required.

## Useful outputs

- single-prop concept with clear silhouette and material zones;
- front, side, and back reference for manual modeling;
- T-pose or A-pose reference for a rigged character;
- orthographic diffuse source for a sign, screen, panel, or decal;
- seamless color texture for broad material variation;
- palette and wear reference for an asset family.

Generated images are references or source art, not automatic 3D. If an optional image-to-3D tool is available and the user wants it, record the tool and prompt, then send the resulting mesh through the normal inspection, cleanup, license, texture, registry, collider, and in-game workflow.

## Prompt contracts

Prop concept:

```text
One worn industrial [asset] for DEADWATER, full object visible, plain neutral background, readable low-poly silhouette, broad diffuse color zones, corrosion and grime at 512x448 game distance, no text, no glossy studio reflections.
```

Modeling sheet:

```text
Orthographic front, side, and back views of the same [asset], aligned scale, neutral pose, unobstructed outline, consistent proportions and details, plain background.
```

Diffuse source:

```text
Flat diffuse color source for [surface], square and seamless, muted worn industrial palette, broad stains and wear, no directional light, no perspective, no normal-map shading, no baked highlights.
```

## Handoff

Record the image path, prompt, generation/edit tool, source-image rights, intended mesh or material use, and whether it ships. Prepare shipping textures through `deadwater-image-generator`; concepts may stay at higher resolution outside runtime texture paths.
