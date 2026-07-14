# STORAGE — SUBLEVEL 2

A true-to-era **PS2-style first-person walking scene** built with React Three Fiber + Vite. One large gritty warehouse room in the spirit of Half-Life 2's industrial spaces, rendered the way the PlayStation 2 actually rendered.

## Run it

```sh
npm install
npm run dev
```

Click the viewport to grab the mouse. **WASD** move · **Shift** run · **Space** jump · **Esc** release.

## Era-authentic rendering choices

| PS2 hardware behavior | Implementation |
| --- | --- |
| 512×448 NTSC framebuffer, stretched to 4:3 | Fixed-size internal render target, bilinear upscale, letterboxed 4:3 viewport |
| Gouraud (per-vertex) lighting on the VU/GS | Custom `ShaderMaterial` computes point lights per vertex; walls/floor tessellated ~1m so light pools bleed across triangles |
| Dithering into a 16-bit framebuffer | 4×4 ordered Bayer dither + 5-bit-per-channel quantization applied on framebuffer write, exactly where the GS did it |
| No linear color pipeline | Whole pipeline runs in gamma space: textures sampled raw, lights specified as display values, no sRGB conversion anywhere |
| Diffuse-only materials | No normal/roughness/AO maps; 256px textures, bilinear mag filter, hard mip transitions (`LinearMipmapNearest`), no anisotropy |
| Perspective-correct texturing | Deliberately **no** PS1 affine wobble or vertex snapping — the PS2 didn't have those artifacts |
| Interlaced CRT output | Faint line darkening at internal resolution + mild corner falloff in the upscale pass |
| Sparse dynamic lights | 8-light budget, one flickering fluorescent with telegraph-noise cadence |

No shadow maps, no postprocessing stack, no tone mapping — vertex lights, fog, and dither.

## Assets

All CC0: textures from [ambientCG](https://ambientcg.com), models from [Poly Haven](https://polyhaven.com) (barrels, ammo box, cardboard boxes, hanging industrial lamp). See [CREDITS.md](public/models/CREDITS.md).
