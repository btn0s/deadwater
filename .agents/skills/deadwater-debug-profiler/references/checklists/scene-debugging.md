# DEADWATER runtime and scene debugging checklist

- Reproduce on the exact game or editor entry before editing.
- Read the first console, network, shader, Web Audio, and page error.
- Confirm the component and all R3F hooks mount below the intended Canvas.
- Confirm ordinary `useFrame` callbacks use default priority and `PS2Pipeline` remains the sole positive-priority render owner.
- Check every pipeline pass restores render target, scene override, visibility, and pass-only uniforms.
- Check ShaderMaterial logs, uniform shapes, varyings, attributes, fallbacks, and disposal.
- Preserve `rawColor`, `NoColorSpace` texture preparation, raw lights, fog, dither, and final blit while isolating color bugs.
- Validate `scene.json` node ids, parent links, transforms, component fields, instance targets, and library semantics.
- Check `types.ts`, `render.tsx`, `inspector.ts`, and `sceneStore.ts` for schema drift.
- Check GLTF external files, cloning, PS2 material replacement, normals and UVs; check FBX texture, scale normalization, and pivot.
- Determine whether custom AABB collision or Rapier owns the observed physics behavior.
- Check pointer-lock source of truth, listener cleanup, key reset, and input capture order.
- Check `AudioContext` unlock gesture, buffer fetch/decode, one-shot trigger, and loop cleanup.
- Check current development hooks and contact-sheet state restoration.
- Verify the exact broken path, neighboring game/editor behavior, build, and production preview.
