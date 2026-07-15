import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAX_LIGHTS, sharedLightUniforms } from '../ps2/PS2Material'
import { sceneDepthUniforms, waterMeshes } from '../ps2/sceneDepth'
import { mulberry32 } from './rand'

/**
 * PS2-style water, the era recipe (Silent Hill 2 / MGS2 school): two copies
 * of ONE soft, low-contrast noise texture UV-scrolled in different
 * directions and blended, gentle vertex bob for silhouette life, per-vertex
 * lighting on a flat surface, constant alpha, GS dither into a 16-bit
 * (R5G6B5) framebuffer.
 *
 * What it deliberately is NOT: a cell/interference pattern (blob boundaries
 * survive layering and read as hard edges), a tight crest highlight band
 * (draws contour lines), or coherently tipped normals (a plane-wide sinusoid
 * turns light pools into stripes). All three were tried and removed.
 */

/** tileable multi-octave value noise — soft photographic grain, no cells */
function makeWaterTexture(): THREE.DataTexture {
  const size = 128
  const rand = mulberry32(0x5eaf00d)

  // wrap-around random lattices, one per octave
  const octaves = [4, 8, 16, 32].map((n) => ({
    n,
    grid: Float32Array.from({ length: n * n }, () => rand()),
  }))
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const sample = (o: { n: number; grid: Float32Array }, u: number, v: number) => {
    const x = u * o.n
    const y = v * o.n
    const x0 = Math.floor(x) % o.n
    const y0 = Math.floor(y) % o.n
    const x1 = (x0 + 1) % o.n
    const y1 = (y0 + 1) % o.n
    const fx = smooth(x - Math.floor(x))
    const fy = smooth(y - Math.floor(y))
    const g = o.grid
    const a = g[y0 * o.n + x0] + (g[y0 * o.n + x1] - g[y0 * o.n + x0]) * fx
    const b = g[y1 * o.n + x0] + (g[y1 * o.n + x1] - g[y1 * o.n + x0]) * fx
    return a + (b - a) * fy
  }

  const base = [13, 24, 22]
  const amp = [9, 13, 11] // low contrast on purpose — motion sells it, not contrast
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      // fBm: halving weights, normalized back to [0,1]
      let t = 0
      let w = 0.5
      let norm = 0
      for (const o of octaves) {
        t += sample(o, u, v) * w
        norm += w
        w *= 0.5
      }
      t = t / norm - 0.5 // centered, roughly [-0.5, 0.5]
      const i = (y * size + x) * 4
      data[i] = Math.max(0, base[0] + amp[0] * 2 * t)
      data[i + 1] = Math.max(0, base[1] + amp[1] * 2 * t)
      data[i + 2] = Math.max(0, base[2] + amp[2] * 2 * t)
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  // trilinear, unlike the wall/floor materials: on a big open plane the hard
  // mip transitions read as bands sweeping across the surface
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

const vertexShader = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  uniform float uLightRadius[${MAX_LIGHTS}];
  uniform float uLightSpot[${MAX_LIGHTS}];
  uniform vec3 uLightDir[${MAX_LIGHTS}];
  uniform float uLightCone[${MAX_LIGHTS}];
  uniform vec3 uAmbient;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vLight;
  varying float vFogDepth;

  void main() {
    vUv = uv;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    // gentle bob for the silhouette at banks and pilings; non-harmonic
    // frequencies so no plane-wide pattern emerges
    float wave =
      sin(worldPos.x * 1.31 + uTime * 1.7) * 0.5 +
      sin(worldPos.z * 2.17 - uTime * 1.1) * 0.35 +
      sin((worldPos.x + worldPos.z) * 0.73 + uTime * 0.6) * 0.15;
    worldPos.y += wave * 0.045;

    // near-flat surface with a faint multi-frequency shimmer — enough tilt
    // to make the light pools breathe, far too little to stripe them
    vec3 worldNormal = normalize(vec3(
      sin(worldPos.x * 2.9 + uTime * 1.4) * 0.03 + sin(worldPos.z * 1.3 - uTime * 0.9) * 0.02,
      1.0,
      sin(worldPos.z * 3.7 - uTime * 1.6) * 0.03 + sin(worldPos.x * 0.9 + uTime * 0.7) * 0.02
    ));

    vec3 light = uAmbient * 1.1;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 toLight = uLightPos[i] - worldPos.xyz;
      float dist = length(toLight);
      float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);
      // smooth the attenuation shoulder: linear falloff has a visible C1
      // break where it hits zero
      atten *= atten;
      float ndl = max(dot(worldNormal, toLight / max(dist, 1e-4)), 0.0);
      float cosDown = toLight.y / max(dist, 1e-4);
      float spot = mix(1.0, mix(0.06, 1.0, smoothstep(-0.12, 0.45, cosDown)), uLightSpot[i]);
      if (uLightCone[i] > 0.0) {
        float along = dot(normalize(-toLight), uLightDir[i]);
        spot *= smoothstep(uLightCone[i], uLightCone[i] + 0.12, along);
      }
      light += uLightColor[i] * (ndl * atten * spot);
    }
    vLight = light;

    vec4 mvPos = viewMatrix * worldPos;
    vFogDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 uScroll1;
  uniform vec2 uScroll2;
  uniform vec2 uRepeat;
  uniform float uOpacity;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform sampler2D uSceneDepth;
  uniform float uCamNear;
  uniform float uCamFar;
  uniform vec2 uResolution;
  uniform float uFoamOn;

  varying vec2 vUv;
  varying vec3 vLight;
  varying float vFogDepth;

  float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    // layer 1: broad drift with the flow; layer 2: finer chop against it
    vec3 layer1 = texture2D(map, vUv * uRepeat + uScroll1).rgb;
    vec3 layer2 = texture2D(map, vUv * uRepeat * 2.3 + uScroll2).rgb;
    vec3 color = mix(layer1, layer2, 0.5);

    color *= vLight;

    // intersection foam: compare this fragment's eye depth against the
    // opaque scene behind it — where geometry pierces the surface the
    // difference goes to zero and a lapping rim appears
    float foam = 0.0;
    if (uFoamOn > 0.5) {
      vec2 suv = gl_FragCoord.xy / uResolution;
      float d = texture2D(uSceneDepth, suv).x;
      float sceneZ = (uCamNear * uCamFar) / (uCamFar - d * (uCamFar - uCamNear));
      float band = clamp(1.0 - (sceneZ - vFogDepth) / 0.4, 0.0, 1.0);
      // the scrolled noise gnaws at the rim so it laps instead of outlining
      float n = clamp((layer2.g - 0.043) * 9.8, 0.0, 1.0);
      foam = smoothstep(0.3, 0.85, band * (0.45 + 0.75 * n)) * step(vFogDepth, sceneZ + 0.4);
      color += vec3(0.20, 0.26, 0.24) * foam * (0.4 + vLight.g);
    }

    float fogFactor = clamp((vFogDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
    color = mix(color, fogColor, fogFactor);

    // 16-bit framebuffer the way the GS actually kept one: R5 G6 B5 —
    // green gets double the steps, exactly where this palette lives
    vec3 steps = vec3(31.0, 63.0, 31.0);
    float dither = (bayer4(gl_FragCoord.xy) - 0.5);
    color = clamp(color + dither / steps, 0.0, 1.0);
    color = floor(color * steps + 0.5) / steps;

    gl_FragColor = vec4(color, uOpacity + foam * 0.12);
  }
`

interface SewerWaterProps {
  position: [number, number, number]
  size: [number, number]
  /** uv scroll direction of the main flow */
  flow?: [number, number]
}

export function SewerWater({ position, size, flow = [0.045, 0] }: SewerWaterProps) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          ...sharedLightUniforms,
          ...sceneDepthUniforms,
          map: { value: makeWaterTexture() },
          uTime: { value: 0 },
          uScroll1: { value: new THREE.Vector2(0, 0) },
          uScroll2: { value: new THREE.Vector2(0, 0) },
          uRepeat: { value: new THREE.Vector2(size[0] / 5, size[1] / 5) },
          uOpacity: { value: 0.85 },
        },
        transparent: true,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const flowRef = useRef(flow)
  flowRef.current = flow
  const mesh = useRef<THREE.Mesh>(null)

  // register with the depth pre-pass so foam sees through the surface
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    waterMeshes.add(m)
    return () => {
      waterMeshes.delete(m)
    }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    material.uniforms.uTime.value = t
    const [fx, fy] = flowRef.current
    ;(material.uniforms.uScroll1.value as THREE.Vector2).set(t * fx, t * fy)
    ;(material.uniforms.uScroll2.value as THREE.Vector2).set(t * -fx * 0.6 + 0.37, t * (fy * 0.6 + 0.035))
  })

  // tessellate by area, not a fixed grid — big planes otherwise show the
  // vertex-lighting facets as hard edges
  const segX = Math.min(64, Math.max(8, Math.round(size[0] * 2)))
  const segY = Math.min(64, Math.max(8, Math.round(size[1] * 2)))
  return (
    <mesh ref={mesh} material={material} position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[size[0], size[1], segX, segY]} />
    </mesh>
  )
}
