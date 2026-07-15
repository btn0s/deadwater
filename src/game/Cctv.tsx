import { useMemo } from 'react'
import * as THREE from 'three'
import { createPS2Material } from '../ps2/PS2Material'
import { cctvTarget } from '../ps2/cctv'

/**
 * The two ends of the security loop: a camera prop above the yard door and
 * a monitor on the office desk showing its feed — mono green, scanlined,
 * softly flickering, refreshed a few frames a second by the pipeline.
 */

const screenMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tFeed;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tFeed, vUv).rgb;
        float luma = dot(c, vec3(0.3, 0.55, 0.15));
        // mono green CCTV with scanlines and a lifted black floor
        float line = mod(floor(vUv.y * 96.0), 2.0) == 0.0 ? 0.82 : 1.0;
        vec3 mono = vec3(0.12, 0.5, 0.22) * (luma * 2.6 + 0.12) * line;
        gl_FragColor = vec4(mono, 1.0);
      }
    `,
    uniforms: { tFeed: { value: cctvTarget.texture } },
  })

export function Cctv() {
  const { shell, screen, camBody } = useMemo(
    () => ({
      shell: createPS2Material({ color: 0x33373b }),
      screen: screenMaterial(),
      camBody: createPS2Material({ color: 0x2b2e32 }),
    }),
    [],
  )

  return (
    <>
      {/* monitor on the office desk's south arm, angled at the chair */}
      <group position={[-17.75, 0.77, 2.42]} rotation={[0, -2.55, 0]}>
        <mesh material={shell} position={[0, 0.16, 0]}>
          <boxGeometry args={[0.34, 0.3, 0.3]} />
        </mesh>
        <mesh material={screen} position={[0, 0.17, 0.153]}>
          <planeGeometry args={[0.27, 0.21]} />
        </mesh>
        <mesh material={shell} position={[0, 0.015, 0.02]}>
          <boxGeometry args={[0.22, 0.035, 0.24]} />
        </mesh>
      </group>
      {/* the camera itself, above the yard-side door */}
      <group position={[20.45, 3.05, 10]} rotation={[0, -Math.PI / 2 + 0.55, -0.25]}>
        <mesh material={camBody}>
          <boxGeometry args={[0.3, 0.12, 0.12]} />
        </mesh>
        <mesh material={camBody} position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 8]} />
        </mesh>
      </group>
    </>
  )
}
