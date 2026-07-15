# DEADWATER editor usability checklist

- Toolbar groups scene/assets, transform mode, history, camera mode, save, and play clearly.
- Active, hover, focus-visible, pressed, disabled, destructive, saving, success, and failure states are distinguishable.
- The hierarchy supports filter, expand/collapse, selection, drag reparent, root drop, and long ids without losing context.
- Selection through the hierarchy and viewport resolves to the same `sceneStore.selectedId`.
- Fly mode captures WASD/QE only while right-mouse look is active; W/E remain gizmo shortcuts otherwise.
- Global shortcuts do not fire while typing in input, select, or textarea elements.
- Transform and component fields come from the shared inspector schema and preserve number, radians/degrees, vector, color, check, text, and select semantics.
- Component add/remove, duplicate, prefab, and delete actions remain visible and safely separated.
- The central viewport stays usable with deep hierarchy and many inspector fields.
- Placement shows the armed asset, supports one-shot click, Shift stamping, drag/drop, and Escape cancel.
- Palette thumbnails have text fallbacks and search remains reachable.
- The assets tab clearly separates model list, staging viewport, prefab name/save, current stage contents, and existing prefabs.
- Undo and redo truthfully enable and restore scene data without stale selection.
- Save exposes pending, success, and failure and writes the same `scene.json` source used by the game.
- Editor physics remains paused and editor interaction does not collect, teleport, animate AI, or mutate inventory.
- A complete select-edit-place-undo-save-reload path passes with no console error.
