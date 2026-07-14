import { useRef, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { Prop, SplitProp, FbxProp, MODELS, FBX_MODELS } from './Prop'
import { PaperWad } from './PaperWad'
import { TrashPile } from './TrashPile'
import { Rack } from './Rack'
import { Lamp } from './Lamp'
import { useEditor, editorStore, type LayoutItem } from './editorStore'

const SPLITTERS: Record<string, (n: string) => string> = {
  militaryCrate: (n) => (n.endsWith('_a') ? 'a' : 'b'),
}

/**
 * A shipment unit: wooden pallet with packages stacked on it. The medium
 * blockout vocabulary of a receiving dock — placed in lanes, not scattered.
 */
export function LoadedPallet({ position, rotationY = 0, variant = 0, inert = false }: {
  position: [number, number]
  rotationY?: number
  variant?: number
  inert?: boolean
}) {
  const sin = Math.sin(rotationY)
  const cos = Math.cos(rotationY)
  const at = (ox: number, oy: number, oz: number): [number, number, number] => [
    position[0] + ox * cos + oz * sin,
    oy,
    position[1] - ox * sin + oz * cos,
  ]
  return (
    <group>
      <FbxProp url={FBX_MODELS.pallet.url} textureUrl={FBX_MODELS.pallet.tex} position={[position[0], 0, position[1]]} rotationY={rotationY} grabbable inert={inert} />
      {variant === 0 && (
        <>
          <Prop url={MODELS.cardboardBox} position={at(-0.25, 0.17, 0.2)} rotationY={rotationY + 0.05} collide={false} grabbable inert={inert} />
          <Prop url={MODELS.cardboardBox} position={at(0.3, 0.17, -0.15)} rotationY={rotationY + 1.62} collide={false} grabbable inert={inert} />
          <Prop url={MODELS.cardboardBox} position={at(0, 0.73, 0)} rotationY={rotationY + 0.9} collide={false} grabbable inert={inert} />
        </>
      )}
      {variant === 1 && (
        <>
          <Prop url={MODELS.woodenCrate} position={at(0, 0.17, 0)} rotationY={rotationY + 0.03} grabbable inert={inert} />
          <Prop url={MODELS.cardboardBox} position={at(-0.15, 0.8, 0.1)} rotationY={rotationY + 0.5} collide={false} grabbable inert={inert} />
        </>
      )}
      {variant === 2 && (
        <>
          <Prop url={MODELS.plasticCrate} position={at(-0.3, 0.17, -0.2)} rotationY={rotationY + 0.08} grabbable inert={inert} />
          <Prop url={MODELS.plasticCrate} position={at(0.35, 0.17, 0.15)} rotationY={rotationY + 1.55} grabbable inert={inert} />
          <Prop url={MODELS.ammoBox} position={at(0, 0.78, 0)} rotationY={rotationY + 0.4} collide={false} grabbable inert={inert} />
        </>
      )}
    </group>
  )
}

/** Render one layout item. When `zeroed`, the item renders at the origin so an
 * editor wrapper group can own the transform. */
export function ItemVisual({ item, inert, zeroed = false }: { item: LayoutItem; inert: boolean; zeroed?: boolean }) {
  const pos: [number, number, number] = zeroed ? [0, 0, 0] : item.pos
  const pos2: [number, number] = zeroed ? [0, 0] : [item.pos[0], item.pos[2]]
  const rot = zeroed ? 0 : (item.rot ?? 0)
  switch (item.kind) {
    case 'prop':
      return (
        <Prop
          url={MODELS[item.model as keyof typeof MODELS]}
          position={pos}
          rotationY={rot}
          grabbable={item.grabbable}
          collide={item.collide ?? true}
          physics={item.physics ?? 'hull'}
          scale={item.scale}
          inert={inert}
        />
      )
    case 'fbx': {
      const m = FBX_MODELS[item.model as keyof typeof FBX_MODELS]
      return (
        <FbxProp
          url={m.url}
          textureUrl={m.tex}
          position={pos}
          rotationY={rot}
          scale={item.scale}
          grabbable={item.grabbable}
          collide={item.collide ?? true}
          physics={item.physics ?? 'hull'}
          inert={inert}
        />
      )
    }
    case 'split':
      return (
        <SplitProp
          url={MODELS[item.model as keyof typeof MODELS]}
          position={pos}
          rotationY={rot}
          groupBy={SPLITTERS[item.model ?? ''] ?? ((n: string) => n)}
          inert={inert}
        />
      )
    case 'paperWad':
      return <PaperWad position={pos} seed={item.seed ?? 1} size={item.size} inert={inert} />
    case 'trashPile':
      return <TrashPile position={pos2} radius={item.radius} height={item.height} seed={item.seed ?? 1} items={item.items} inert={inert} />
    case 'loadedPallet':
      return <LoadedPallet position={pos2} rotationY={rot} variant={item.variant ?? 0} inert={inert} />
    case 'rack':
      return <Rack position={pos2} rotationY={rot} inert={inert} />
    case 'lamp':
      // lamps keep lighting even in the editor — the room would be black otherwise
      return (
        <Lamp
          position={pos}
          lightIndex={item.light ?? 11}
          lightY={item.lightY}
          color={item.color}
          intensity={item.intensity}
          radius={item.radius ?? 18}
          flicker={item.flicker}
          lightAt={zeroed ? item.pos : undefined}
        />
      )
    case 'prefab':
      return <PrefabInstance name={item.model ?? ''} pos={pos} rot={rot} inert={inert} />
  }
}

/** An instance of a user-authored prefab: children rendered as independent
 * items at the instance's transform (physics per child, like LoadedPallet). */
function PrefabInstance({ name, pos, rot, inert }: { name: string; pos: [number, number, number]; rot: number; inert: boolean }) {
  const { prefabs } = useEditor()
  const def = prefabs.find((p) => p.name === name)
  if (!def) return null
  const sin = Math.sin(rot)
  const cos = Math.cos(rot)
  return (
    <group>
      {def.children.map((c, i) => {
        const child: LayoutItem = {
          ...c,
          id: `${name}-${i}`,
          pos: [
            pos[0] + c.pos[0] * cos + c.pos[2] * sin,
            pos[1] + c.pos[1],
            pos[2] - c.pos[0] * sin + c.pos[2] * cos,
          ],
          rot: (c.rot ?? 0) + rot,
        }
        return <ItemVisual key={i} item={child} inert={inert} />
      })}
    </group>
  )
}

function EditableItem({ item, selected }: { item: LayoutItem; selected: boolean }) {
  const group = useRef<THREE.Group>(null)

  // keep the wrapper in sync when the item changes from the panel
  useEffect(() => {
    group.current?.position.set(...item.pos)
    group.current?.rotation.set(0, item.rot ?? 0, 0)
  }, [item.pos, item.rot])

  const commit = () => {
    const g = group.current
    if (!g) return
    editorStore.update(item.id, {
      pos: [+g.position.x.toFixed(3), +g.position.y.toFixed(3), +g.position.z.toFixed(3)],
      rot: +g.rotation.y.toFixed(3),
    })
  }

  return (
    <>
      <group
        ref={group}
        position={item.pos}
        rotation={[0, item.rot ?? 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          editorStore.select(item.id)
        }}
      >
        <ItemVisual item={item} inert zeroed />
      </group>
      {selected && (
        <TransformControls
          object={group as React.RefObject<THREE.Group>}
          mode={editorStore.get().gizmoMode}
          translationSnap={0.05}
          rotationSnap={Math.PI / 36}
          onMouseUp={commit}
        />
      )}
    </>
  )
}

/** All layout-driven props: physics scene in game mode, gizmo scene in editor. */
export function PlacedItems() {
  const { active, items, selectedId } = useEditor()

  if (active) {
    return (
      <>
        {items.map((item) => (
          <EditableItem key={item.id} item={item} selected={item.id === selectedId} />
        ))}
      </>
    )
  }

  return (
    <>
      {items.map((item) => (
        <group key={`${item.id}:${item.rev ?? 0}`}>
          <ItemVisual item={item} inert={false} />
        </group>
      ))}
    </>
  )
}
