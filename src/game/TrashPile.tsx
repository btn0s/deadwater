import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { createPS2Material, prepTexture } from '../ps2/PS2Material'
import { addCollider } from './collision'
import { Prop, MODELS } from './Prop'
import { PaperWad } from './PaperWad'
import { mulberry32 } from './rand'

const TRASH_URL = '/textures/TrashPile.jpg'

interface TrashPileProps {
  position: [number, number]
  radius?: number
  height?: number
  seed: number
  /** how many loose junk items rain onto the mound */
  items?: number
}

type JunkKind = 'bag' | 'can' | 'paper' | 'tin'

function pickKind(r: number): JunkKind {
  if (r < 0.3) return 'bag'
  if (r < 0.55) return 'can'
  if (r < 0.85) return 'paper'
  return 'tin'
}

/**
 * A compacted debris mound that acts as the anchor of a trash pile. Loose
 * junk spawns just above the mound with seeded scatter and physics-settles
 * onto its slopes.
 */
export function TrashPile({ position, radius = 1.4, height = 0.4, seed, items = 6 }: TrashPileProps) {
  const trashMap = useTexture(TRASH_URL, (t) => {
    prepTexture(t)
    // photo texture: mirrored wrap hides the tiling seams
    t.wrapS = THREE.MirroredRepeatWrapping
    t.wrapT = THREE.MirroredRepeatWrapping
    t.needsUpdate = true
  })

  const { geometry, material, rotation } = useMemo(() => {
    const rand = mulberry32(seed)
    // top half-sphere, jittered into an irregular heap; rim stays on the floor
    const geo = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    const stretchX = 0.85 + rand() * 0.4
    const stretchZ = 0.85 + rand() * 0.4
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const jitter = 0.75 + rand() * 0.5
      pos.setXYZ(
        i,
        pos.getX(i) * radius * stretchX * jitter,
        pos.getY(i) * height * (0.7 + rand() * 0.6),
        pos.getZ(i) * radius * stretchZ * jitter,
      )
    }
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    geo.dispose()
    const material = createPS2Material({ map: trashMap, repeat: [2, 1.2] })
    return { geometry: flat, material, rotation: rand() * Math.PI * 2 }
  }, [seed, radius, height, trashMap])

  // junk raining onto the mound: seeded offsets, heights, and rotations
  const junk = useMemo(() => {
    const rand = mulberry32(seed * 7 + 1)
    return Array.from({ length: items }, (_, i) => {
      const angle = rand() * Math.PI * 2
      const dist = rand() * radius * 0.55
      const x = position[0] + Math.cos(angle) * dist
      const z = position[1] + Math.sin(angle) * dist
      const y = height + 0.4 + rand() * 0.7
      return {
        kind: pickKind(rand()),
        pos: [x, y, z] as [number, number, number],
        rotY: rand() * Math.PI * 2,
        seed: seed * 31 + i,
      }
    })
  }, [seed, items, radius, height, position])

  // keep the player from walking through the heap
  useEffect(() => {
    const r = radius * 0.7
    return addCollider({
      minX: position[0] - r,
      maxX: position[0] + r,
      minZ: position[1] - r,
      maxZ: position[1] + r,
    })
  }, [position, radius])

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh">
        <mesh geometry={geometry} material={material} position={[position[0], 0, position[1]]} rotation-y={rotation} />
      </RigidBody>
      {junk.map((j, i) => {
        switch (j.kind) {
          case 'bag':
            return <Prop key={i} url={MODELS.trashbag} position={j.pos} rotationY={j.rotY} collide={false} grabbable />
          case 'can':
            return <Prop key={i} url={MODELS.canRusted} position={j.pos} rotationY={j.rotY} collide={false} grabbable />
          case 'tin':
            return <Prop key={i} url={MODELS.oilTin} position={j.pos} rotationY={j.rotY} collide={false} grabbable />
          case 'paper':
            return <PaperWad key={i} position={j.pos} seed={j.seed} size={0.07 + (j.seed % 5) * 0.01} />
        }
      })}
    </>
  )
}
