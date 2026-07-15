# DEADWATER shader cookbook

Use this cookbook for shader and material work in this repository. It targets the Three.js version in `package.json`, currently `^0.185.1`, and the custom `ShaderMaterial` pipeline under `src/ps2/`.

## Non-negotiable shader contract

- `[DEADWATER policy]` Ordinary world materials use gamma/display-space color math.
- `[DEADWATER policy]` Ordinary world materials use diffuse plus additive emissive only.
- `[DEADWATER policy]` Ordinary scene lights are evaluated per vertex.
- `[DEADWATER policy]` Core opaque output uses linear fog, 4x4 ordered dither, and 5-bit-per-channel quantization.
- `[DEADWATER policy]` Color textures use raw sampling, bilinear magnification, hard mip transitions, and anisotropy 1.
- `[DEADWATER policy]` Imported stock PBR materials are replaced at runtime.

Do not introduce `MeshStandardMaterial`, `MeshPhysicalMaterial`, PMREM, IBL, tone mapping, output color transforms, normal maps, metalness, roughness, AO, clearcoat, or transmission into the shipped scene renderer.

## Recipe index

| Need | Use | Owner | Class |
| --- | --- | --- | --- |
| Opaque or cutout world surface | `createPS2Material` | `src/ps2/PS2Material.ts` | DEADWATER policy |
| Raw display-space color | `rawColor`, `rawColorFromString` | `src/ps2/PS2Material.ts` | DEADWATER policy |
| World texture setup | `prepTexture` | `src/ps2/PS2Material.ts` | DEADWATER policy |
| Broad anti-tiling | `bombing` / `uBomb` | `src/ps2/PS2Material.ts` | Modern cheat |
| Flashlight light and shadow | torch uniforms and hard depth compare | `src/ps2/PS2Material.ts`, `src/ps2/torchShadow.ts` | Modern cheat |
| Dirty transparent window | `createGlassMaterial` | `src/engine/render.tsx` | Modern cheat |
| Sewer water and foam | `SewerWater` shader | `src/game/SewerWater.tsx` | Modern cheat around policy core |
| Security feed | `screenMaterial` | `src/game/Cctv.tsx` | Modern cheat |
| Final display treatment | blit shader | `src/ps2/PS2Pipeline.tsx` | Modern cheat around policy target |

## Ordinary material recipes

### Diffuse texture and tint

```ts
import { createPS2Material, prepTexture } from '../ps2/PS2Material'

const material = createPS2Material({
  map: prepTexture(diffuseTexture),
  color: '#8c8877',
  repeat: [4, 2],
})
```

- **When:** walls, floors, props, structural primitives, and imported diffuse surfaces.
- **Cost:** one diffuse sample, the fixed per-vertex 20-slot light loop, fog, and dither.
- **Read:** use tint to unify the palette, not to repair an incorrectly authored diffuse texture.

### Diffuse plus emissive

```ts
const material = createPS2Material({
  map: prepTexture(diffuseTexture),
  emissiveMap: prepTexture(emissiveTexture),
})
```

The shared shader computes:

```glsl
vec3 color = texel.rgb * uColor * light + texture2D(emissiveMap, vUv).rgb;
```

- **When:** lamp bulbs embedded in a housing, signs, screens, machine indicators.
- **Cost:** one additional texture sample.
- **Read:** the diffuse housing still follows vertex lights. Only painted emissive texels glow.

### Fullbright signal

```ts
const signal = createPS2Material({ fullbright: true, color: 0xffe4a8 })
```

- **When:** visible lamp face, small status light, void card, or deliberately unlit signal geometry.
- **Cost:** the shader still executes the fixed vertex loop before mixing to white.
- **Read:** fullbright is visible geometry, not a light source. Pair it with a `light` component when it must illuminate nearby surfaces.

Do not use fullbright on a whole prop to hide poor lighting.

## Raw color recipe

Three.js color setters can interpret hexadecimal values through color management. DEADWATER explicitly requests raw display values:

```ts
import { rawColor, rawColorFromString } from '../ps2/PS2Material'

const concreteTint = rawColor(0x6f7069)
const editorTint = rawColorFromString('#6f7069')
```

`rawColor` calls `setHex` with `THREE.LinearSRGBColorSpace` so the stored channel values match the supplied display values used by the shader. Use these helpers for material, ambient, fog, and light colors that enter the raw pipeline.

Do not add an sRGB-to-linear conversion around these helpers. The project intentionally avoids that workflow.

## Texture preparation recipe

Use the shared boundary:

```ts
export function prepTexture(tex: THREE.Texture): THREE.Texture {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapNearestFilter
  tex.anisotropy = 1
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}
```

- `[DEADWATER policy]` Bilinear magnification keeps the PS2-style presentation from turning into PSX nearest-neighbor pixelation.
- `[DEADWATER policy]` Nearest mip selection keeps mip level changes hard.
- `[DEADWATER policy]` Anisotropy remains 1.
- `[DEADWATER policy]` `NoColorSpace` prevents texture decode before display-space shader math.

Water is a documented exception. `makeWaterTexture` in `src/game/SewerWater.tsx` uses trilinear minification because hard mip bands sweep across its large animated plane.

## Core Gouraud lighting recipe

Reuse `sharedLightUniforms` and the vertex path in `src/ps2/PS2Material.ts`. The shader:

1. transforms the vertex and normal to world space;
2. starts from ambient with a small normal-Y tilt;
3. loops through all 20 compiled light slots;
4. applies distance, Lambert, fixture shade, and optional cone terms;
5. skips the flashlight slot because that light is evaluated per fragment;
6. interpolates `vLight` across the triangle.

The standard fix for a faceted or missing light pool is local topology, normals, radius, or placement. It is not a second fragment-light implementation.

When writing a special material that should remain scene-lit, copy the current uniform and vertex-light structure from `src/ps2/PS2Material.ts` at implementation time. Do not copy an old snippet from this guide and assume it matches the live shader.

## Core fog and ordered-dither recipe

Custom opaque world shaders must preserve the current fog and output quantization. Use this shape:

```glsl
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

vec3 applyDeadwaterOutput(
  vec3 color,
  float fogDepth,
  vec3 fogColor,
  float fogNear,
  float fogFar
) {
  float fogFactor = clamp((fogDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
  color = mix(color, fogColor, fogFactor);

  float dither = (bayer4(gl_FragCoord.xy) - 0.5) / 31.0;
  color = clamp(color + dither, 0.0, 1.0);
  return floor(color * 31.0 + 0.5) / 31.0;
}
```

- **When:** a new opaque shader genuinely cannot use `createPS2Material`.
- **Cost:** small fragment ALU, no extra samples or pass.
- **Read:** dither operates at the internal framebuffer coordinate. Verify it through `PS2Pipeline` at 512x448.

Do not include Three.js tone-mapping or color-space chunks after this function. The returned value is already the intended display-space output.

## Animated UV recipe

`createPS2Material` exposes `uUvOffset`. Update the existing uniform instead of rebuilding a material:

```ts
const material = createPS2Material({ map: prepTexture(diffuse), repeat: [2, 2] })

useFrame(({ clock }) => {
  const offset = material.uniforms.uUvOffset.value as THREE.Vector2
  offset.set(clock.elapsedTime * 0.02, 0)
})
```

- **When:** conveyor markings, slow grime crawl, or a bounded special surface.
- **Cost:** one uniform update; the ordinary sample and material remain shared only if every consumer uses the same offset.
- **Read:** keep scroll slow enough that hard mip transitions and 512x448 presentation remain stable.

If instances need independent offsets, a shared material cannot carry per-object values. Use geometry UVs, instance attributes, or separate bounded material instances.

## Texture bombing recipe

Enable the existing path through scene data:

```json
{
  "type": "surface",
  "width": 12,
  "height": 6,
  "texture": "Concrete031",
  "repeat": [6, 3],
  "bombing": 1
}
```

`sampleBombed` in `src/ps2/PS2Material.ts` samples three randomly offset triangular-lattice cells and sharpens their blend.

- `[Modern cheat]` This is stochastic anti-tiling, not a PS2 hardware claim.
- **When:** a large wall, floor, or bank visibly repeats even after correct UV scale.
- **Cost:** three diffuse samples instead of one on every covered fragment.
- **Read:** inspect for ghosted high-contrast features. Bombing works best on low-frequency grime and concrete, not signs, brick courses, text, or directional metal.

Use zero when it does not materially improve the active frame.

## Hard-shadowed flashlight recipe

The fragment shader uses one conditional depth lookup:

```glsl
float d = texture2D(uShadowMap, p.xy).x;
if (p.z - 0.0035 > d) shadow = 0.0;
```

- `[Modern cheat]` The flashlight alone receives per-fragment Lambert lighting and hard shadow mapping.
- **When:** the equipped torch must create a round, occluded first-person light pool.
- **Cost:** a 512x512 scene depth render while equipped, plus one depth sample for fragments inside the cone.
- **Read:** the one-tap edge is intentional. Do not add PCF softness, cascades, or ordinary-light shadows.

Tune the camera, bias, radius, and cone through `src/game/Flashlight.tsx` and `src/ps2/torchShadow.ts`. Do not fork the shadow math into another material.

## Dirty glass sheen recipe

The glass shader in `src/engine/render.tsx` uses:

```glsl
float glow = clamp(dot(vLight, vec3(0.333)), 0.0, 1.5);
float sheen = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0)
  * 0.35 * glow;
vec3 color = grime * uColor * vLight * 2.0 + vec3(sheen * 0.5);
float alpha = 0.22 + dirt * 0.4 + sheen;
```

- `[Modern cheat]` The per-fragment view-dependent sheen fakes reflected light without PBR or an environment map.
- **When:** dirty warehouse windows and similar rare panes.
- **Cost:** one grime sample, per-fragment normalization and power, transparency sorting, and overdraw.
- **Read:** grime carries the surface at face-on angles; sheen appears only at grazing views and where vertex lights provide energy.

Do not use this for clean refractive glass, repeated bottle fields, or every glossy surface.

## Depth-aware foam recipe

The water path samples the opaque depth texture at `gl_FragCoord / uResolution`, reconstructs eye depth, and adds a narrow noisy rim where scene geometry intersects the water.

- `[Modern cheat]` This requires a full opaque depth pre-pass every gameplay frame.
- **When:** pilings, banks, grates, junk, and seawalls need readable water contact.
- **Cost:** the depth pass, one scene-depth sample, two water texture layers, and foam ALU.
- **Read:** the scrolled noise must break the rim. A clean contour around every object looks like an outline bug.

The water fragment shader maintains its own R5G6B5-style dither and quantization. Do not silently copy that local exception into core opaque materials.

## CCTV screen recipe

The CCTV screen shader in `src/game/Cctv.tsx` samples the 128x96 feed once, computes luma, applies a green monochrome palette, lifts black, and alternates scanline brightness.

- `[Modern cheat]` The feed is a real extra scene render at four updates per second.
- **When:** the office monitor needs a live surveillance read.
- **Cost:** periodic scene submission, a small render target, one screen sample, and simple fragment ALU.
- **Read:** preserve the low-rate chop and low resolution. Verify the feed shows useful yard motion and does not stall the main frame.

Do not use the CCTV target as a general portal or mirror system.

## CRT blit recipe

The final blit samples the 512x448 main target once, darkens alternating internal rows by 7 percent, and applies a mild quadratic corner falloff.

- `[Modern cheat]` This approximates CRT display character in a modern browser.
- `[DEADWATER policy]` Bilinear target filtering and the 4:3 CSS viewport are the chosen presentation.
- **Cost:** one fullscreen triangle and one main-target sample.
- **Read:** it should be noticeable in comparison but should not crush the dark sewer or interfere with HUD text.

Do not add curvature, chromatic aberration, bloom, noise, mask patterns, or rolling distortion without a separate cheat review and comparison capture.

## Resource lifecycle

- Memoize material, geometry, and generated texture creation in React components.
- Dispose resources uniquely owned by a component in an effect cleanup.
- Do not dispose shared textures from `useTexture`, the model cache, or shared uniform resources from an individual material.
- Update uniform values in place. Do not replace shared uniform objects installed into every material.
- Keep render targets owned by their pipeline module or component and dispose them if their owner unmounts permanently.
- Do not create shader variants through changing source strings every frame.

## Shader review checklist

Before accepting shader code, verify:

- claim label is hardware fact, DEADWATER policy, or modern cheat;
- core versus cheat path is explicit;
- owner and consumers are named;
- raw display-space math is preserved;
- ordinary scene lighting remains per vertex;
- diffuse and emissive remain the ordinary material inputs;
- fog and dither match the core path, or the cheat exception is documented;
- texture filtering and color-space flags match policy;
- texture sample, pass, transparency, vertex, program, and render-target costs are counted;
- resources are memoized and disposed correctly;
- identical before and after live frames exist;
- `npm run build` and `npm run lint` pass.

Reject a shader whose only purpose is generic noise, glow, fake PBR, or making the image look older without improving a named DEADWATER surface or gameplay read.
