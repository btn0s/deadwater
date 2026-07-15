import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

interface SceneNode {
  id: string
  components?: Array<{
    type: string
    url?: string
    body?: string
    grabbable?: boolean
    carryStyle?: string
  }>
}

const scene = JSON.parse(
  await readFile(new URL('../src/engine/scene.json', import.meta.url), 'utf8'),
) as { nodes: SceneNode[] }

const twoHandModelPaths = [
  '/cardboard_box_01/',
  '/wooden_crate_01/',
  '/plastic_crate_01/',
  '/old_military_crate/',
]

test('box and crate grabbables are explicitly authored as two-hand carries', () => {
  const boxNodes = scene.nodes.filter((node) => {
    const model = node.components?.find((component) => component.type === 'model')
    const physics = node.components?.find((component) => component.type === 'physics')
    return (
      physics?.body === 'dynamic' &&
      physics.grabbable === true &&
      twoHandModelPaths.some((path) => model?.url?.includes(path))
    )
  })

  assert.equal(boxNodes.length, 45, 'expected the current authored box/crate set')
  assert.deepEqual(
    boxNodes.filter((node) =>
      node.components?.find((component) => component.type === 'physics')?.carryStyle !== 'twoHand'
    ),
    [],
  )
})

test('non-box grabbables retain the default one-hand pose', () => {
  const incorrectlyTagged = scene.nodes.filter((node) => {
    const model = node.components?.find((component) => component.type === 'model')
    const physics = node.components?.find((component) => component.type === 'physics')
    const isBox = twoHandModelPaths.some((path) => model?.url?.includes(path))
    return physics?.grabbable === true && physics.carryStyle === 'twoHand' && !isBox
  })

  assert.deepEqual(incorrectlyTagged, [])
})
