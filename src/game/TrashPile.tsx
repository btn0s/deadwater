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
    // a low displaced grid: plane, semi-random subdivision, interior raised a little
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, 4, 4)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const isEdge = Math.max(Math.abs(x), Math.abs(y)) > radius * 0.99
      if (isEdge) continue
      const cell = (radius * 2) / 4
      const jx = x + (rand() - 0.5) * cell * 0.7
      const jy = y + (rand() - 0.5) * cell * 0.7
      const falloff = 1 - Math.hypot(jx, jy) / (radius * 1.35)
      const elevation = Math.max(0, height * falloff * (0.5 + rand()))
      pos.setXYZ(i, jx, jy, elevation)
    }
    geo.rotateX(-Math.PI / 2)
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    geo.dispose()
    const material = createPS2Material({ map: trashMap, repeat: [1.5, 1.5] })
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
