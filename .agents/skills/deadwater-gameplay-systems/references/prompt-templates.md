# DEADWATER gameplay prompt templates

Use only the template that matches the request. Replace every placeholder with project facts.

## Gameplay-system change

```text
Use $deadwater-gameplay-systems to change this DEADWATER gameplay path.

Player-visible behavior:
Owning scene component or game system:
Input and pointer-lock behavior:
State transition:
Rapier or custom-blocking needs:
Inventory, carry, prompt, and audio effects:
Editor fields and scene.json authoring needs:
Deterministic seed or dev hook:
Failure and cleanup paths:

Keep React 19, R3F, the fixed 4:3 camera, PS2Pipeline render ownership, scene.json as the authored-world source, and game/editor separation. Verify build, real input, console, the editor when data changes, and a relevant contact sheet.
```

## Scene-component addition

```text
Use $deadwater-gameplay-systems to add this authorable DEADWATER component.

Component purpose:
Fields and valid values:
Visual behavior in game and editor:
Game-only side effects:
Physics, interaction, inventory, or audio behavior:
Representative scene node:

Update the Component union, renderer, inspector field schema, inspector default, scene data, and mode gating as one change. Do not create a parallel scene format or JSX-only level path.
```

## First-person area pass

```text
Use $deadwater-gameplay-systems to improve this DEADWATER area.

Player promise and target feeling:
Arrival frame and orientation landmark:
First choice and teaching beat:
Pressure and payoff:
Carry, inventory, lighting, or route tradeoff:
Recovery and return path:

Author the space in scene.json and the in-browser editor. Judge readability from the fixed 4:3 player camera and 512x448 output. Verify the active route, interaction occlusion, relevant dev hooks, and named contact sheets.
```

## Physics and carry investigation

```text
Use $deadwater-gameplay-systems to fix this DEADWATER physics or carry issue.

Reproduction:
Expected body and collider state:
Actual state:
Custom AABB or Rapier owner:
Held mode and inventory-lock state:
Frame-rate or tunneling conditions:

Preserve custom AABB player navigation plus the kinematic Rapier push capsule. Use the existing Physics provider and declarative bodies. Verify every release and cleanup path, low-FPS behavior, editor pause, and body registration cleanup.
```
