# DEADWATER UI patterns

Use this reference for the runtime HUD and overlays or the browser editor. Decide which surface owns the task before choosing layout, density, typography, motion, and verification.

## Two interface systems

| Trait | Game | Editor |
| --- | --- | --- |
| Primary job | Keep the player oriented and expose immediate actions | Author, inspect, organize, and save scene data |
| Frame | Fixed 4:3 `.viewport`, letterboxed in the page | Full-window desktop workspace |
| Visual language | Sparse PS2-era terminal and survival-game overlay | Modern Unity-style dark tool chrome |
| Density | Low | High but structured |
| Typography | Compact uppercase monospace | Small readable tool text and monospace values |
| Motion | Brief blink, fade, state pulse | Immediate selection, hover, drag, focus, save status |
| Canvas | Fixed low-resolution pipeline and final blit | Normal editor R3F Canvas with anti-aliasing and device DPR |
| State owner | interaction, inventory, carry, player lock | `sceneStore`, inspector schema, local search and stage state |

Share a restrained green accent and industrial neutrality when useful. Do not share the game UI's intentional friction or low information density with the editor.

## Game frame and layer order

`App.tsx` renders a `.frame` containing a 4:3 `.viewport`. The Canvas fills it. DOM UI layers sit above the Canvas:

```text
pointer-locked play: crosshair -> prompt -> hotbar -> transition fade
initial desktop menu: harbor attract camera -> dim overlay -> title, blurb, CLOCK IN, controls
pointer-unlocked play: scene -> dim overlay -> title, resume hint, controls
mobile preview:       atmospheric 4:3 Canvas -> description card -> share action
```

Keep overlay hit testing intentional. Most HUD elements use `pointer-events: none`; real buttons opt into pointer events. This prevents the HUD from stealing pointer lock or world clicks.

The game Canvas still renders at 512x448 before upscale. CSS pixel precision cannot rescue a world prompt or reticle that is poorly positioned against the play image. Review both DOM edges and scene readability.

## Reticle and prompt

- Keep the reticle at the exact viewport center because interaction raycasts from NDC `[0, 0]`.
- Preserve a small neutral idle state, a readable grabbable state, and a distinct held state.
- Do not move the reticle in CSS without changing the ray contract.
- Put the prompt close enough to associate with the target but below the focal hit area.
- Keep prompt width stable, one line when possible, and short enough for 4:3.
- Use the input token plus the action. Do not repeat a paragraph of control instructions during play.
- Hide the prompt when pointer lock is absent or a transition blocks interaction.

Test against bright lamps, black fog, water, patterned walls, and clutter. A light shadow or modest scrim is preferable to a large panel.

## Hotbar and equipment

The hotbar communicates four independent facts:

- four slot positions and number keys
- current slot
- item label
- stowed or carry-locked state

Use fixed square slots and fixed label bounds. Active, stowed, and locked states need shape or opacity differences, not color alone. Keep the bar low enough to leave the center view clear, but inside the viewport with a consistent bottom inset.

When adding icons, use small local SVG or CSS shapes only when they improve recognition at the actual displayed size. A label remains useful for unfamiliar equipment. Do not add a large inventory panel unless the game receives an inventory-browsing mechanic.

## Entry, resume, and modal overlays

The initial menu and the pointer-lock resume overlay are distinct states. CLOCK IN transitions from the harbor attract camera to play and requests pointer lock inside the click gesture. Later pointer-lock release shows the lighter resume overlay. Keep both fast:

- clear title and one primary action
- concise controls grouped by importance
- real buttons opt into pointer events
- dim the game without fully erasing spatial context
- release and re-enter pointer lock predictably

If adding pause settings, separate pointer-lock state from settings-open state. Escape should not cause an immediate lock request. Keyboard focus must remain visible. Buttons need stable hover, active, focus-visible, disabled, and touch/coarse-pointer states as applicable.

## PS2-era game UI style

Aim for late-console-era restraint, not a fake operating system:

- hard rectangular geometry and thin borders
- limited desaturated green, gray, bone, and black
- small monospace labels with deliberate tracking
- slight CRT-like text shadow only where contrast needs it
- stepped blink or brief fade rather than elastic web animation
- status shown through world change whenever possible

Avoid excessive scanlines on DOM text, tiny unreadable raster fonts, noisy glitch loops, chromatic aberration, beveled card stacks, glass panels, large gradients, and dashboard charts. The renderer already supplies the visual period.

## Mobile preview

The current design detects coarse pointers, missing pointer-lock support, or the `?mobile` preview flag. It keeps an atmospheric 4:3 harbor viewport, then places a compact description/share card below it. It does not expose CLOCK IN or touch gameplay.

- Keep the message honest that mouse and keyboard are required.
- Preserve the actual 4:3 game presentation as the preview image.
- Center and wrap text for narrow portrait screens.
- Keep the share button reachable and make its copied state stable.
- Respect reduced motion for any decorative camera drift or blinking text.
- Verify `?mobile` on desktop as well as a coarse-pointer emulation.

Only add virtual controls after a deliberate product decision and a complete controller design. A joystick overlay without pointer-lock replacement, camera look, carry, equipment, and editor-entry decisions is not mobile support.

## Editor workspace

`EditorApp.tsx` uses a stable tool layout:

```text
toolbar
hierarchy | scene or asset viewport | details
palette strip
```

The editor should preserve the central viewport while letting supporting panels scroll independently. Do not let hierarchy depth or component count grow the whole page.

### Toolbar

- Keep scene/assets mode, gizmo mode, undo/redo, fly/orbit, save, and play visually grouped.
- Show active modes through more than color when practical.
- Disable undo and redo truthfully.
- Give placement mode a clear, temporary banner with click, Shift stamp, and Escape cancel guidance.
- Keep save state visible long enough to read. Failure must not look like success.
- The play action opens the game entry and should not silently save unrelated edits.

### Hierarchy

- Preserve indentation, caret, display name, and component badge.
- Keep selected, hover, keyboard focus, drag source, and valid drop target distinguishable.
- Filter must retain enough ancestry to explain where a match lives.
- Ellipsize long labels visually but expose the full id through title or details.
- Root-drop, cycle prevention, and subtree selection are state rules owned by `sceneStore`.
- Large node counts need independent scrolling and a persistent filter.

### Viewport

- The viewport is the largest region and should not collapse under narrow window widths.
- Preserve object selection, transform gizmo visibility, placement raycasting, grid, view cube, and camera controls.
- Fly controls own right-mouse look and WASD/QE only while active. Orbit controls own drag and wheel only in orbit mode.
- Avoid overlay controls on top of the gizmo or critical scene center.
- Provide visible focus or mode state so users understand why W/E acts as movement or gizmo selection.

### Details inspector

- Generate component fields from `COMPONENT_FIELDS` and nested-path helpers.
- Group transform, each component, add-component, duplication, prefab, and delete actions.
- Keep labels and units clear. Rotation displayed as degrees must convert back to radians.
- Long arrays and many components need vertical scrolling without losing node identity.
- Destructive actions need strong separation and focus states. Do not hide delete beside a routine edit.
- Empty selection should explain the next action without occupying the viewport.

### Palette and placement

- Keep model, prefab, and special-kind search fast and persistent during placement.
- Thumbnails may be pixelated, but names need a usable fallback.
- Armed placement state must be obvious.
- Click places once; Shift keeps the tool armed; Escape cancels.
- Drag-and-drop and click-to-arm should converge on the same `PlacingSpec` state.
- Horizontal scrolling must not hide the search or current placement state.

### Assets and prefab stage

- Separate the registered-model list, stage viewport, and prefab controls.
- Make empty stage, selected stage item, name validation, replacement, save, and clear states explicit.
- A saved prefab lives as a library subtree in `scene.json`; the UI must not imply a separate asset database.
- Keep stage transforms and model selection understandable without running gameplay physics.

## State wiring

Game DOM reads focused stores and subscriptions. Editor DOM reads `useSceneEditor`. Local component state is appropriate for search strings, temporary stage composition, and form selection, but not for duplicated scene nodes, inventory, pointer-lock truth, or save status.

Prefer semantic buttons, inputs, selects, and labels. Preserve focus rings. Do not use a clickable `div` when a button supplies keyboard behavior, except where drag-and-drop tree and tile semantics require a composite interaction and receive equivalent keyboard handling.

## Responsive behavior

Game:

- Preserve 4:3 at desktop and laptop sizes.
- Let the outer page letterbox rather than stretching the Canvas.
- Test the smallest supported desktop viewport for control-copy wrapping and hotbar clearance.
- Use the non-playable mobile preview for unsupported coarse-pointer layouts.

Editor:

- Target desktop authoring first.
- Set minimum practical widths for hierarchy and details, with independent scrolling.
- On narrow windows, prefer collapsible side panels or an explicit compact mode over shrinking field text below legibility.
- Keep toolbar controls reachable through wrapping or overflow without covering the viewport.
- Test deep trees, long ids, many fields, a full palette, and save messages.

## Verification

For game UI:

- Enter and release pointer lock.
- Aim at an interactable and grabbable.
- Pick up, stow, switch, carry a small prop, and carry a large prop.
- Trigger a fade and return.
- Review the real 4:3 final view at supported desktop sizes.
- Preview the mobile layout with `?mobile` and confirm CLOCK IN is absent.

For editor UI:

- Select through viewport and hierarchy.
- Filter, expand, drag-reparent, and root-drop.
- Edit transforms and component fields.
- Add and remove a component.
- Place once, Shift stamp, and Escape cancel.
- Undo and redo.
- Compose or load a prefab.
- Save successfully and inspect a simulated or real failure state.

Run the build and inspect console errors after either path.

## Common failures

- Game UI becomes a generic dashboard or landing page.
- Editor UI inherits sparse game styling and hides information.
- Crosshair and interaction ray no longer share the center.
- DOM controls steal the click intended to enter pointer lock.
- Hotbar changes width as item labels change.
- Mobile preview claims support the game does not provide.
- Hierarchy, details, or palette overflow grows the whole editor page.
- Editor shortcuts fire while typing.
- Local UI state forks `sceneStore` or inventory truth.
- The editor's crisp viewport is mistaken for final game readability.
