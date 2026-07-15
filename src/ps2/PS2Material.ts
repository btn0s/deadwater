import * as THREE from 'three'
import { torchShadowUniforms } from './torchShadow'

/**
 * PS2-era material: Gouraud (per-vertex) lighting like the Graphics Synthesizer
 * pipeline, diffuse map only, linear fog, and 4x4 ordered dithering down to
 * 5 bits per channel applied on framebuffer write — which is literally how the
 * GS dithered into a 16-bit framebuffer.
 */

export const MAX_LIGHTS = 20

// Shared light state. The same object references are installed into every
// material's uniforms, so mutating these lights the whole scene at once.
// Everything runs in gamma space, exactly like the GS did: textures are
// sampled raw, lights and colors are specified as raw display values, and no
// linear<->sRGB conversion happens anywhere in the pipeline.
export function rawColor(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace)
}

/** rawColor from a '#rrggbb' string (e.g. a Leva color control) */
export function rawColorFromString(hex: string): THREE.Color {
  return rawColor(parseInt(hex.replace('#', ''), 16))
}

export const lightPositions = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -1000, 0))
export const lightColors = Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0))
export const lightRadii: number[] = new Array(MAX_LIGHTS).fill(1)
/** 0 = omnidirectional, 1 = shaded fixture casting a wide downward cone */
export const lightSpots: number[] = new Array(MAX_LIGHTS).fill(0)
/** aimed spotlights (flashlight): unit direction per slot */
export const lightDirs = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -1, 0))
/** cos of the cone half-angle; 0 disables the cone (default) */
export const lightCones: number[] = new Array(MAX_LIGHTS).fill(0)
/** 1 = this light is baked into lightmaps — lightmapped surfaces skip it at
 * runtime (props and un-mapped geometry still take it live) */
export const lightBaked: number[] = new Array(MAX_LIGHTS).fill(0)
export const ambientColor = rawColor(0x35383f)

const fogColorUniform = { value: rawColor(0x07080a) }
const fogNearUniform = { value: 10 }
const fogFarUniform = { value: 48 }
export const fogColor = fogColorUniform.value
/** live fog settings — mutate to retune the whole scene */
export const fogSettings = { color: fogColorUniform.value, near: fogNearUniform, far: fogFarUniform }

export const sharedLightUniforms = {
  uLightPos: { value: lightPositions },
  uLightColor: { value: lightColors },
  uLightRadius: { value: lightRadii },
  uLightSpot: { value: lightSpots },
  uLightDir: { value: lightDirs },
  uLightCone: { value: lightCones },
  uLightBaked: { value: lightBaked },
  uAmbient: { value: ambientColor },
  fogColor: fogColorUniform,
  fogNear: fogNearUniform,
  fogFar: fogFarUniform,
}

let whiteTexture: THREE.Texture | null = null
function getWhiteTexture() {
  if (!whiteTexture) {
    const data = new Uint8Array([255, 255, 255, 255])
    whiteTexture = new THREE.DataTexture(data, 1, 1)
    whiteTexture.needsUpdate = true
  }
  return whiteTexture
}

let blackTexture: THREE.Texture | null = null
function getBlackTexture() {
  if (!blackTexture) {
    const data = new Uint8Array([0, 0, 0, 255])
    blackTexture = new THREE.DataTexture(data, 1, 1)
    blackTexture.needsUpdate = true
  }
  return blackTexture
}

const vertexShader = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  uniform float uLightRadius[${MAX_LIGHTS}];
  uniform float uLightSpot[${MAX_LIGHTS}];
  uniform vec3 uLightDir[${MAX_LIGHTS}];
  uniform float uLightCone[${MAX_LIGHTS}];
  uniform float uLightBaked[${MAX_LIGHTS}];
  uniform vec3 uAmbient;
  uniform vec2 uUvRepeat;
  uniform vec2 uUvOffset;
  uniform float uFullbright;
  uniform float uHasLightmap;
  uniform float uShadowSlot;

  varying vec2 vUv;
  varying vec2 vUvRaw;
  varying vec3 vLight;
  varying vec3 vTorch;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vUv = uv * uUvRepeat + uUvOffset;
    vUvRaw = uv;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    vec3 torch = vec3(0.0);

    // ambient with a faint hemisphere tilt so unlit side/down faces keep
    // shape; lightmapped surfaces carry ambient in the map instead
    vec3 light = uAmbient * (0.95 + 0.3 * worldNormal.y) * (1.0 - uHasLightmap);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 toLight = uLightPos[i] - worldPos.xyz;
      float dist = length(toLight);
      float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);
      float ndl = max(dot(worldNormal, toLight / max(dist, 1e-4)), 0.0);
      // shaded fixtures throw a wide downward cone: fade out near horizontal,
      // nothing upward — the shade blocks it; a little light leaks past the
      // shade (bounce) so the ceiling above fades instead of snapping to black
      float cosDown = toLight.y / max(dist, 1e-4);
      float spot = mix(1.0, mix(0.06, 1.0, smoothstep(-0.12, 0.45, cosDown)), uLightSpot[i]);
      // aimed cone (flashlight): fade by angle off the beam axis
      if (uLightCone[i] > 0.0) {
        float along = dot(normalize(-toLight), uLightDir[i]);
        spot *= smoothstep(uLightCone[i], uLightCone[i] + 0.12, along);
      }
      // baked lights already live in the lightmap on mapped surfaces
      float live = mix(1.0, 1.0 - uLightBaked[i], uHasLightmap);
      vec3 contrib = uLightColor[i] * (ndl * atten * spot * live);
      // the torch's share travels separately so the fragment can shadow it
      if (float(i) == uShadowSlot) torch += contrib;
      else light += contrib;
    }
    vLight = mix(light, vec3(1.0), uFullbright);
    vTorch = torch * (1.0 - uFullbright);

    vec4 mvPos = viewMatrix * worldPos;
    vFogDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D emissiveMap;
  uniform sampler2D uLightmap;
  uniform float uHasLightmap;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform float uShadowOn;
  uniform vec3 uColor;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform float uBomb; // 0 = plain tiling; >0 = stochastic lattice density (cells per tile)

  varying vec2 vUv;
  varying vec2 vUvRaw;
  varying vec3 vLight;
  varying vec3 vTorch;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  // compact recursive 4x4 Bayer matrix, range [0, 1)
  float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  vec2 hash22(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  // texture bombing: sample at 3 nearby triangular-lattice points, each with
  // its own random UV offset, and blend — breaks up visible tiling
  vec4 sampleBombed(vec2 uv) {
    vec2 skewed = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (uv * uBomb);
    vec2 base = floor(skewed);
    vec2 f = fract(skewed);
    float t3 = 1.0 - f.x - f.y;

    vec2 v1; vec2 v2; vec2 v3; vec3 w;
    if (t3 > 0.0) {
      v1 = base; v2 = base + vec2(0.0, 1.0); v3 = base + vec2(1.0, 0.0);
      w = vec3(t3, f.y, f.x);
    } else {
      v1 = base + vec2(1.0, 1.0); v2 = base + vec2(1.0, 0.0); v3 = base + vec2(0.0, 1.0);
      w = vec3(-t3, 1.0 - f.y, 1.0 - f.x);
    }
    // sharpen the blend to cut ghosting in the transition zones
    w = pow(w, vec3(4.0));
    w /= (w.x + w.y + w.z);

    return texture2D(map, uv + hash22(v1)) * w.x +
           texture2D(map, uv + hash22(v2)) * w.y +
           texture2D(map, uv + hash22(v3)) * w.z;
  }

  void main() {
    vec4 texel = uBomb > 0.0 ? sampleBombed(vUv) : texture2D(map, vUv);

    // torch shadow: one hard tap against the light's depth map — the beam
    // stops at whatever it hits, aliased edges and all
    float shadow = 1.0;
    if (uShadowOn > 0.5) {
      vec4 sc = uShadowMatrix * vec4(vWorldPos, 1.0);
      vec3 p = sc.xyz / max(sc.w, 1e-4);
      if (p.x > 0.0 && p.x < 1.0 && p.y > 0.0 && p.y < 1.0 && p.z > 0.0 && p.z < 1.0) {
        float d = texture2D(uShadowMap, p.xy).x;
        if (p.z - 0.0035 > d) shadow = 0.0;
      }
    }

    // baked light (Quake-style x2 overbright) + live per-vertex light +
    // the shadow-tested torch beam
    vec3 light = vLight + vTorch * shadow + texture2D(uLightmap, vUvRaw).rgb * 2.0 * uHasLightmap;
    vec3 color = texel.rgb * uColor * light + texture2D(emissiveMap, vUv).rgb;

    float fogFactor = clamp((vFogDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
    color = mix(color, fogColor, fogFactor);

    // GS-style dither on framebuffer write: 5 bits per channel (16-bit mode)
    float dither = (bayer4(gl_FragCoord.xy) - 0.5) / 31.0;
    color = clamp(color + dither, 0.0, 1.0);
    color = floor(color * 31.0 + 0.5) / 31.0;

    gl_FragColor = vec4(color, 1.0);
  }
`

export interface PS2MaterialOptions {
  map?: THREE.Texture | null
  repeat?: [number, number]
  color?: number | string | THREE.Color
  fullbright?: boolean
  /** stochastic anti-tiling: lattice cells per texture tile (0 = off) */
  bombing?: number
  /** additive glow texture (bulbs, screens); the rest of the mesh stays lit normally */
  emissiveMap?: THREE.Texture | null
  /** baked lighting (Quake school): replaces ambient + baked lights with a
   * texture sampled by raw surface uv; dynamic lights still add on top */
  lightmap?: THREE.Texture | null
}

function resolveColor(color: PS2MaterialOptions['color']): THREE.Color {
  if (color instanceof THREE.Color) return color.clone()
  if (typeof color === 'string') return rawColorFromString(color)
  return rawColor(color ?? 0xffffff)
}

export function createPS2Material(opts: PS2MaterialOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...sharedLightUniforms,
      ...torchShadowUniforms,
      map: { value: opts.map ?? getWhiteTexture() },
      emissiveMap: { value: opts.emissiveMap ?? getBlackTexture() },
      uLightmap: { value: opts.lightmap ?? getBlackTexture() },
      uHasLightmap: { value: opts.lightmap ? 1 : 0 },
      uColor: { value: resolveColor(opts.color) },
      uUvRepeat: { value: new THREE.Vector2(...(opts.repeat ?? [1, 1])) },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uFullbright: { value: opts.fullbright ? 1 : 0 },
      uBomb: { value: opts.bombing ?? 0 },
    },
  })
}

/** Era-appropriate texture sampling: bilinear mag, hard mip transitions, no
 * aniso, and NO sRGB decode — texels are used raw, as the GS did. */
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
