import * as THREE from 'three'

/**
 * PS2-era material: Gouraud (per-vertex) lighting like the Graphics Synthesizer
 * pipeline, diffuse map only, linear fog, and 4x4 ordered dithering down to
 * 5 bits per channel applied on framebuffer write — which is literally how the
 * GS dithered into a 16-bit framebuffer.
 */

export const MAX_LIGHTS = 8

// Shared light state. The same object references are installed into every
// material's uniforms, so mutating these lights the whole scene at once.
export const lightPositions = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -1000, 0))
export const lightColors = Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0))
export const lightRadii: number[] = new Array(MAX_LIGHTS).fill(1)
export const ambientColor = new THREE.Color(0x1a1c22)

const fogColorUniform = { value: new THREE.Color(0x07080a) }
const fogNearUniform = { value: 8 }
const fogFarUniform = { value: 42 }
export const fogColor = fogColorUniform.value

const sharedLightUniforms = {
  uLightPos: { value: lightPositions },
  uLightColor: { value: lightColors },
  uLightRadius: { value: lightRadii },
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

const vertexShader = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  uniform float uLightRadius[${MAX_LIGHTS}];
  uniform vec3 uAmbient;
  uniform vec2 uUvRepeat;
  uniform float uFullbright;

  varying vec2 vUv;
  varying vec3 vLight;
  varying float vFogDepth;

  void main() {
    vUv = uv * uUvRepeat;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);

    vec3 light = uAmbient;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 toLight = uLightPos[i] - worldPos.xyz;
      float dist = length(toLight);
      float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);
      float ndl = max(dot(worldNormal, toLight / max(dist, 1e-4)), 0.0);
      light += uLightColor[i] * (ndl * atten);
    }
    vLight = mix(light, vec3(1.0), uFullbright);

    vec4 mvPos = viewMatrix * worldPos;
    vFogDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  varying vec2 vUv;
  varying vec3 vLight;
  varying float vFogDepth;

  // compact recursive 4x4 Bayer matrix, range [0, 1)
  float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    vec4 texel = texture2D(map, vUv);
    vec3 color = texel.rgb * uColor * vLight;

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
  color?: THREE.ColorRepresentation
  fullbright?: boolean
}

export function createPS2Material(opts: PS2MaterialOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...sharedLightUniforms,
      map: { value: opts.map ?? getWhiteTexture() },
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uUvRepeat: { value: new THREE.Vector2(...(opts.repeat ?? [1, 1])) },
      uFullbright: { value: opts.fullbright ? 1 : 0 },
    },
  })
}

/** Era-appropriate texture sampling: bilinear mag, hard mip transitions, no aniso. */
export function prepTexture(tex: THREE.Texture): THREE.Texture {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapNearestFilter
  tex.anisotropy = 1
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
