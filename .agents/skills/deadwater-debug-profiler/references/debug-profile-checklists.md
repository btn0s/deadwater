# DEADWATER debug and profile guide

Use this for blank or wrong frames, shader failures, raw-color regressions, bad scene data, editor bugs, missing models, Rapier or player collision problems, pointer-lock and audio issues, hook errors, and performance work.

## Capture the reproduction

Record:

- command and build mode
- game `/` or editor `/editor.html`
- browser, viewport, DPR, and device class
- scene area and player or editor camera position
- pointer-lock, inventory, carry, selection, placement, and save state
- exact input sequence
- first console, page, network, shader, or audio error
- whether the problem happens after HMR, full reload, or production preview

Use existing deterministic controls where possible. `window.__teleport(x, z, yaw, pitch)` and named contact sheets can make a scene view repeatable. Do not assume contact-sheet rendering uses the same camera or postprocess as active play.

## R3F and `useFrame` ownership

Start here for frozen frames, double updates, disappearing output, invalid hook calls, or effects that run in the wrong order.

### Known ownership

- R3F owns Canvas creation, frame scheduling, scene, camera, and WebGLRenderer.
- Gameplay systems call `useFrame` at default priority for movement, carry, interactions, audio cadence, light flicker, water, actors, culling, and equipment.
- `PS2Pipeline` calls `useFrame(callback, 1)`. Any positive priority disables automatic R3F rendering for that Canvas, so this callback must complete the final render.
- The editor uses normal automatic R3F rendering because it does not mount `PS2Pipeline`.
- `DevViews` and `ThumbnailFactory` issue explicit offscreen renders from invoked asynchronous work, not as competing continuous frame owners.

### Checks

- Confirm the hook runs beneath the intended Canvas and React tree.
- Check that conditional rendering does not change hook order inside a component.
- Search every positive-priority `useFrame`. One unplanned callback can take render ownership or reorder passes.
- Check whether a callback reads state before its owner updates it in the same frame.
- Clamp large `rawDt` where movement or smoothing uses it.
- Keep mutable per-frame state in refs, not React state writes every tick.
- Check effect cleanup for listeners, registries, timeouts, and development hooks, especially under React 19 Strict Mode behavior in development.
- When testing a frame-order hypothesis, add a short-lived counter or timestamp. Remove it before profiling.

### Failure patterns

- Blank game but working editor: inspect `PS2Pipeline`, render targets, and final blit first.
- Working first frame then freeze: inspect positive-priority frame owner, thrown exceptions, and state restoration after offscreen renders.
- Double-speed simulation: look for duplicate mounts, duplicate listeners, or a second frame loop.
- Hook error: look for R3F hooks outside Canvas or a component called as a normal function.

## PS2Pipeline pass debugging

Expected order in `PS2Pipeline`:

```text
optional CCTV -> hide water and set depth override -> scene depth
-> optional torch shadow -> restore override and water visibility
-> publish depth uniforms -> enable foam and torch shadow
-> main 512x448 target -> disable pass-only uniforms
-> default framebuffer -> fullscreen blit
```

Check every mutable renderer or scene property is restored:

- current render target
- `scene.overrideMaterial`
- water visibility
- zone visibility temporarily changed for CCTV
- foam and torch-shadow uniforms
- camera near and far uniforms

If an exception can occur between mutation and restoration, use a narrow `try/finally` around the shared state. Do not broadly catch shader or render errors and continue with corrupted state.

### Blank or stale final image

- Confirm `target.texture` is the blit uniform.
- Confirm fullscreen triangle geometry and post camera remain valid.
- Confirm the callback reaches `renderer.setRenderTarget(null)` and renders `postScene`.
- Check target dimensions and framebuffer completeness.
- Check Canvas CSS visibility and overlays after proving the buffer is nonblank.

### Water foam and depth

- Water must be hidden during the depth pass and restored before main color.
- `sceneDepthUniforms` must receive the current depth texture and current player camera near/far.
- `uFoamOn` must be true only around the pipeline's main pass. Editor, thumbnails, and contact sheets use other cameras and must not sample stale depth as if current.
- A foam bug visible only in contact sheets may be expected because those paths intentionally keep foam off.

### Torch shadow

- The shadow slot decides whether the torch pass runs.
- Update the torch shadow matrix before rendering its target.
- Clear the scene override before the main pass.
- Check bias, near/far, cone, and target contents before changing material lighting globally.

### CCTV

- CCTV updates at an interval, not every frame.
- The yard is temporarily forced visible and then restored.
- Distinguish stale feed by design from a broken target or hidden camera layer.

## ShaderMaterial and GLSL errors

Read the full program log. The first GLSL compile or link error usually makes later messages noise.

Check:

- Three.js and WebGL shader dialect support for syntax and loop bounds.
- Matching varying names and types between vertex and fragment shaders.
- Uniform presence, type, and array length.
- Shared uniform object shape, especially `{ value }` wrappers.
- Texture uniforms are non-null or use the intended white or black fallback.
- `ShaderMaterial` flags such as `transparent`, `depthWrite`, `depthTest`, and `side`.
- Geometry attributes required by the shader: position, normal, and uv.
- Material disposal and stale references after HMR.
- `renderer.debug.checkShaderErrors` and program diagnostics in development when available.

The core PS2 material uses compile-time `MAX_LIGHTS` arrays, raw colors, diffuse and emissive maps, Gouraud vertex lighting, fog, ordered dither, and optional torch shadow. When changing `MAX_LIGHTS` or a shared uniform, update every shader that consumes the shared light arrays, including glass.

## Raw-color pipeline

Color in DEADWATER is intentional and nonstandard:

- `rawColor` uses `LinearSRGBColorSpace` input interpretation to keep numeric display values raw.
- `prepTexture` sets `NoColorSpace`, bilinear magnification, hard mip transitions, no anisotropy, and repeat wrapping.
- `createPS2Material` multiplies raw texels, raw tint, and shared raw light values.
- The fragment shader fogs, dithers, and quantizes before output.
- The final blit samples the target and applies line darkening and corner falloff.

If colors wash out, darken, or double-convert:

1. Inspect the texture's `colorSpace` and whether `prepTexture` ran.
2. Inspect the tint and light construction path.
3. Check whether a loader material escaped `applyPS2Materials`.
4. Check renderer output and tone-mapping changes.
5. Compare a direct target pixel and the final blit before changing lighting constants.

Do not fix a raw-pipeline bug by marking every texture sRGB, enabling tone mapping, replacing shaders with standard materials, or adding a color-correction pass.

## `scene.json`, schema, and editor bugs

`scene.json` contains `{ nodes: SceneNode[] }`. Nodes form a tree through `parent` ids but remain a flat array.

Validate:

- every node has a unique non-empty id
- every non-null parent exists, including the special library organization
- parent links have no cycles
- transform position has three finite numbers
- rotation is absent, a finite yaw, or a finite three-number Euler tuple
- scale is absent or a sensible finite number
- every component has a known `type` and valid required fields
- instance targets exist and do not recurse infinitely
- library roots are excluded from normal scene roots
- component fields, defaults, and renderer support stay aligned

### Missing or wrong world object

- Confirm JSON import reached `sceneNodes` after HMR or full reload.
- Check `indexScene` maps the parent to the expected children.
- Check the node is not a library definition or under a missing parent.
- Check `SceneRoot` mode and the component renderer.
- Check instance prefix names and lookup target.
- Check transforms, scale, model URL, visibility, fog, and culling.

### Editor state

- `sceneStore` clones initial nodes and owns selection, expansion, placement, thumbnails, view mode, camera mode, history, prefab operations, and save status.
- A mutation should call `record()` once before changing nodes and refresh undo/redo flags.
- Reparent must reject self-parent and descendant cycles.
- Remove operates on the full subtree.
- Duplicate needs fresh ids and correct copied parent links.
- Prefab conversion moves data into a library subtree and leaves an instance.
- SAVE is a dev-only POST to `/__scene`; production preview cannot persist edits through that middleware.

For save bugs, inspect request method, response status, body shape, Vite server mode, and file content. Do not change UI success copy to hide a failed request.

## GLTF and FBX loading

### GLTF path

- Models load through `useGLTF(url)` and registered GLTF URLs preload.
- Clone the loaded scene before replacing materials or changing transforms.
- `applyPS2Materials` walks meshes, preserves diffuse and emissive maps through `prepTexture`, creates PS2 materials, tags lamp glass, and disables shadows.
- Split models clone geometry into pieces and apply world transforms before creating per-piece bodies.

Check missing external `.bin` files and texture requests, URL case, MIME type, model bounds, empty scene, missing uv or normal attributes, material arrays, and cloned material ownership.

### FBX path

- Models load through `useFBX(url)` and an explicit base-color texture through `useTexture(texture)`.
- The loader clones the object, detects large centimeter-scale bounds, applies `0.01` scale when appropriate, updates world matrices, rests the object on y=0, and replaces mesh materials.
- A missing texture string, wrong scale threshold, unusual pivot, or shared replacement material can explain a model that is invisible, floating, or wrongly colored.

The editor thumbnail factory uses `three-stdlib` loaders in a staging scene and unlit materials. A good thumbnail does not prove the runtime PS2 material, collider, pivot, or final scale is correct.

## Rapier and custom collision

Determine the owner before editing:

- Player cannot pass a wall or slides incorrectly: custom AABB list and `moveWithCollision`.
- Player passes through loose debris or fails to push it: kinematic `PlayerBody` capsule and Rapier body state.
- Prop falls, bounces, tunnels, or sleeps incorrectly: Rapier body, collider, damping, density, CCD, and spawn overlap.
- Held prop sticks or escapes: `CarrySystem` body-type transition, target clamp, release path, and inventory lock.

Checks:

- body and collider mount below the intended Physics provider
- editor Physics is paused
- explicit cuboid sizes are half-extents
- hull and trimesh are used on supported body types
- grabbable registration has current visual root and body handle
- body returns from kinematic to dynamic on every release path
- `setNextKinematicTranslation` receives finite values
- custom blockers register and unregister once
- world transforms are updated before deriving AABBs
- ordinary fast tosses do not tunnel

Use `window.__testCollision` and `window.__colliders` for the custom path. Add narrow development-only Rapier state reads for the physics path.

## Pointer lock and input

Checks:

- The listener is attached to the active Canvas element.
- Click requests pointer lock only when not already locked.
- `pointerlockchange` is the source of truth for player lock and overlay state.
- Mouse movement changes yaw and pitch only while locked.
- Key state clears on unlock so movement cannot stick.
- The editor-entry E shortcut only fires when neither browser pointer lock nor development lock is active and focus is not in an input.
- Interaction E uses capture so the aimed door or pickup wins over the editor shortcut.
- Right-button carry prevents the context menu and releases on window pointer up.
- Editor right-mouse fly control captures and releases the pointer and clears state on blur or visibility change.

Embedded or headless browsers may not provide pointer lock. Use the development `__devLock` hook only to isolate gameplay behavior, then test real pointer lock in a capable browser.

## Audio unlock and playback

Web Audio is created lazily by `ac()` and unlocked on the first pointer down.

Check:

- a real user gesture occurs before expected playback
- `AudioContext.state` reaches `running`
- sample URLs return valid audio and decode succeeds
- `play()` is not called before a buffer exists when the sound is critical
- sample variants and gain graph connect to the current master
- looped ambience switches without duplicate sources
- old sources stop after fade
- footsteps ignore teleports and airborne movement
- component remount does not add duplicate unlock listeners

Surface fetch and decode rejections during debugging. A missing sound should not become an unhandled promise rejection that masks a render error.

## Development hooks and contact sheets

Known hooks include:

- `__playerPos`, `__teleport`, `__devLock`
- `__testCollision`, `__colliders`
- `__inventory`
- `__sceneStore`
- `__sheet`
- light-slot hooks defined by the runtime

Check that hooks exist only in development, reference current state, and are deleted on unmount when installed by a component.

`__sheet` renders labeled cameras into a temporary offscreen target, reads pixels, composes a DOM canvas, and POSTs PNG data to the dev middleware. It temporarily changes fog and ambient and must restore the previous target and values. Named sets include overall, office, dock, and sewer.

Contact-sheet failure checklist:

- development mode and middleware are active
- requested set name exists
- render target allocation succeeds
- ambient, fog, and previous target restore after capture
- POST name passes middleware validation
- output file is writable
- offscreen render did not leave pipeline or scene state corrupted

## Performance profiling

### Repeatable baseline

Record after warmup:

- CPU frame time distribution, not only average FPS
- viewport and Canvas CSS size
- game DPR and editor DPR
- renderer calls, triangles, points, lines
- geometries and textures
- visible and dynamic object counts
- Rapier body and collider counts when relevant
- render targets and their dimensions
- JS heap trend when available
- build chunks and largest asset requests

Use `npm run build` and `npm run preview` for production conclusions. Development HMR and React checks are useful for lifecycle bugs but not final performance numbers.

### Interpret renderer metrics

`renderer.info.render.calls` counts work from each render invocation. One visible game frame can run several passes. Capture whether torch is on, whether CCTV updated that frame, and whether a contact sheet or thumbnail render occurred.

The fixed game DPR is already `1` and main output is 512x448. Do not apply generic adaptive-DPR advice before proving the bottleneck is outside the fixed targets. The editor does use device DPR and may need a cap on high-density displays if measured GPU cost justifies it.

### Classify the bottleneck

- CPU update: many `useFrame` callbacks, scene indexing churn, raycasts, allocations, React rerenders, audio generation, editor DOM layout.
- Physics: too many dynamic bodies, expensive colliders, continuous wakefulness, tunneling recovery, held-body work.
- GPU draw: many objects, materials, split meshes, repeated scene passes.
- GPU vertex: tessellated surfaces multiplied across depth, shadow, and main passes.
- GPU fragment: water, glass overdraw, main color, blit, high editor DPR.
- Memory: loaded textures, cloned materials, model clones, render targets, thumbnails, undisposed geometry or materials.
- Network/build: large model textures, duplicate assets, unexpected editor code in the game chunk.

### Project-fit optimizations

- Share immutable geometry, texture, and material resources where ownership permits.
- Use instancing for repeated static detail when it does not break per-node selection or interactions.
- Cull zones and distant detail without hiding CCTV requirements.
- Simplify fixed colliders and reduce unnecessary dynamic bodies.
- Reduce surface tessellation only after checking Gouraud lighting quality.
- Reduce unique material clones and dispose owned materials on unmount.
- Avoid per-frame vector, array, and object allocation.
- Throttle noncritical feeds and diagnostics.
- Cap editor DPR only after measuring editor GPU cost.
- Keep the fixed game target, raw-color path, fog, dither, water depth, and torch shadow unless the task explicitly revises the renderer.

Optimize one variable and remeasure the identical scenario.

## Production preview and regression matrix

After a shared runtime or performance change, test:

- production game entry
- production editor entry for read-only/runtime behavior, noting dev save middleware is absent
- pointer lock enter, release, and re-enter
- an interactable, pickup, inventory change, and carry state
- Rapier debris and custom wall collision
- audio first-gesture unlock
- torch on and off
- water and foam in active play
- CCTV update
- editor selection, fly/orbit, gizmo, and thumbnail stage
- development contact sheet and scene save separately under the dev server

## Bug report format

```text
Symptom:
Reproduction:
Owner:
Hypothesis:
Evidence that rejected alternatives:
Root cause:
Fix:
Development verification:
Production-preview verification:
Residual risk:
```

## Common mistakes

- Guessing from a screenshot without reproducing the input and state.
- Counting every render call as an accidental duplicate in a multipass pipeline.
- Adding another positive-priority frame callback.
- Fixing raw-color output with standard color-management advice.
- Editing only `scene.json` or only the component union and leaving schema drift.
- Trusting editor thumbnails as runtime model proof.
- Debugging player navigation in Rapier when custom AABB collision owns it.
- Testing audio without a user gesture.
- Profiling development mode and reporting it as player performance.
- Leaving diagnostic logging, targets, hooks, or state mutations active after the investigation.
