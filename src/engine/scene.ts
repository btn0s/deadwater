import type { SceneFile, SceneNode } from './types'
import data from './scene.json'

/** The authored world. scene.json is the source of truth; the editor writes
 * it back through the /__scene dev middleware. */
export const sceneNodes: SceneNode[] = (data as SceneFile).nodes
