import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAX_LIGHTS, sharedLightUniforms } from '../ps2/PS2Material'

/**
 * PS2-style sewer water, the classic recipe: two copies of one murk texture
 * scrolling in different directions blended 50/50, sine vertex waves on a
 * tessellated grid, per-vertex lighting, constant alpha, and the same
 * GS-style dither/quantize as everything else.
 */

function makeMurkTexture(): THREE.DataTexture {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const base = [22, 42, 38]
  const crest = [92, 132, 112]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s =
        Math.sin(x * 0.35 + Math.sin(y * 0.45) * 2.2) +
        Math.sin((x + y * 2.3) * 0.16) +
        Math.sin(y * 0.55 + Math.sin(x * 0.22) * 1.7)
      const t = Math.pow(THREE.MathUtils.clamp(s / 3 + 0.5, 0, 1), 1.5)
      const i = (y * size + x) * 4
      data[i] = base[0] + (crest[0] - base[0]) * t
      data[i + 1] = base[1] + (crest[1] - base[1]) * t
      data[i + 2] = base[2] + (crest[2] - base[2]) * t
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapNearestFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

const vertexShader = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  uniform float uLightRadius[${MAX_LIGHTS}];
  uniform float uLightSpot[${MAX_LIGHTS}];
  uniform vec3 uAmbient;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vLight;
  varying float vFogDepth;
  varying float vCrest;

  void main() {
    vUv = uv;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    // crossed sine waves, evaluated in world space so seams never show
    float wave =
      sin(worldPos.x * 1.7 + uTime * 1.9) * 0.5 +
      sin(worldPos.z * 2.3 - uTime * 1.3) * 0.35 +
      sin((worldPos.x + worldPos.z) * 0.9 + uTime * 0.7) * 0.15;
    worldPos.y += wave * 0.045;
    vCrest = wave * 0.5 + 0.5;

    // waves tip the normal a little for the vertex lighting
    vec3 worldNormal = normalize(vec3(
      -cos(worldPos.x * 1.7 + uTime * 1.9) * 0.18,
      1.0,
      -cos(worldPos.z * 2.3 - uTime * 1.3) * 0.14
    ));

    vec3 light = uAmbient * 1.1;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 toLight = uLightPos[i] - worldPos.xyz;
      float dist = length(toLight);
      float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);
      float ndl = max(dot(worldNormal, toLight / max(dist, 1e-4)), 0.0);
      float cosDown = toLight.y / max(dist, 1e-4);
      float spot = mix(1.0, mix(0.06, 1.0, smoothstep(-0.12, 0.45, cosDown)), uLightSpot[i]);
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

  varying vec2 vUv;
  varying vec3 vLight;
  varying float vFogDepth;
  varying float vCrest;

  float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    // layer 1: broad drift with the flow; layer 2: finer chop against it
    vec3 layer1 = texture2D(map, vUv * uRepeat + uScroll1).rgb;
    vec3 layer2 = texture2D(map, vUv * uRepeat * 1.9 + uScroll2).rgb;
    vec3 color = mix(layer1, layer2, 0.5);

    // crests catch the light: cheap sparkle band, no fresnel on the GS
    color += vec3(0.10, 0.13, 0.11) * smoothstep(0.72, 1.0, vCrest);

    color *= vLight;

    float fogFactor = clamp((vFogDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
    color = mix(color, fogColor, fogFactor);

    float dither = (bayer4(gl_FragCoord.xy) - 0.5) / 31.0;
    color = clamp(color + dither, 0.0, 1.0);
    color = floor(color * 31.0 + 0.5) / 31.0;

    gl_FragColor = vec4(color, uOpacity);
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
          map: { value: makeMurkTexture() },
          uTime: { value: 0 },
          uScroll1: { value: new THREE.Vector2(0, 0) },
          uScroll2: { value: new THREE.Vector2(0, 0) },
          uRepeat: { value: new THREE.Vector2(size[0] / 4, size[1] / 4) },
          uOpacity: { value: 0.82 },
        },
        transparent: true,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const flowRef = useRef(flow)
  flowRef.current = flow

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    material.uniforms.uTime.value = t
    const [fx, fy] = flowRef.current
    ;(material.uniforms.uScroll1.value as THREE.Vector2).set(t * fx, t * fy)
    ;(material.uniforms.uScroll2.value as THREE.Vector2).set(t * -fx * 0.6 + 0.37, t * (fy * 0.6 + 0.021))
  })

  return (
    <mesh material={material} position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[size[0], size[1], 48, 10]} />
    </mesh>
  )
}
