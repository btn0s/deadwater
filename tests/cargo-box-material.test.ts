import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

interface SceneNode {
  id: string
  components?: Array<{
    type: string
    shape?: string
    texture?: string
    crush?: number
    seed?: number
  }>
}

const scene = JSON.parse(
  await readFile(new URL('../src/engine/scene.json', import.meta.url), 'utf8'),
) as { nodes: SceneNode[] }

test('cargo uses cardboard textures without shrink-wrap geometry', async () => {
  const wrapNodes = scene.nodes.filter((node) => /^cargo-(?:tall|low)\/wrap-/.test(node.id))
  assert.deepEqual(wrapNodes.map((node) => node.id), [])

  const boxes = scene.nodes.filter((node) => /^cargo-(?:tall|low)\/box-/.test(node.id))
  assert.equal(boxes.length, 5)
  const textures = boxes.map((node) =>
    node.components?.find((component) => component.type === 'primitive')?.texture,
  )
  assert.deepEqual(new Set(textures), new Set(['Cardboard002', 'Cardboard004']))

  const boxComponents = boxes.map((node) =>
    node.components?.find((component) => component.type === 'primitive'),
  )
  assert.ok(boxComponents.every((component) => (component?.crush ?? 0) > 0))
  assert.equal(new Set(boxComponents.map((component) => component?.seed)).size, boxes.length)

  const textureRegistry = await readFile(
    new URL('../src/engine/textures.ts', import.meta.url),
    'utf8',
  )
  assert.match(textureRegistry, /Cardboard002: '\/textures\/Cardboard002\.jpg'/)
  assert.match(textureRegistry, /Cardboard004: '\/textures\/Cardboard004\.jpg'/)
})
