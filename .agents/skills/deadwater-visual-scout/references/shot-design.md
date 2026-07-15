# Fixed-camera shot design

Use this reference to turn a visual review question into repeatable camera coordinates. A good set is a test fixture for human or agent inspection, not a cinematic sequence.

## Shot specification

Define each shot before changing code:

| Field | Decision |
| --- | --- |
| Set | Lowercase output group, at most 24 characters |
| Label | Short statement of what the reviewer should inspect |
| Projection | Perspective for lived scale; orthographic for layout |
| Position | Explicit stable `[x, y, z]` world coordinate |
| Target | Explicit stable `[x, y, z]` point of interest |
| FOV or half-width | Framing with enough context to orient the reviewer |
| Acceptance | Landmarks and relationships that must be visible |

Prefer coordinates anchored to authored scene geometry. Avoid coordinates derived from a moving actor, physics body, random effect, or current player state.

## Useful shot roles

Choose roles that directly answer the review question:

- **Orientation:** establishes the whole area and major landmarks.
- **Approach or threshold:** shows what a player-height observer sees when entering.
- **Subject in context:** shows the asset or feature together with nearby geometry.
- **Detail or occlusion:** reveals clipping, scale, clearance, silhouette, or a blocked sightline.
- **Reverse or recovery:** checks the return view only when navigation clarity or back-facing composition is part of the question.
- **Plan:** uses an orthographic camera to explain spatial relationships that perspective obscures.

A four-shot set can be stronger than six redundant views. Add a shot only when it has a different acceptance condition.

## Code pattern

Add a stable entry to `makeViewSets()`:

```ts
'pump-room': [
  {
    label: 'entry orientation',
    camera: look(persp(60), [-10, 1.65, -19], [-10, 1.1, -27]),
  },
  {
    label: 'pump clearance',
    camera: look(persp(58), [-11, 1.8, -25], [-16.5, 1, -32.5]),
  },
],
```

Quote a hyphenated property name in TypeScript. Keep the existing 4:3 camera aspect and near/far planes unless the renderer itself is in scope.

## Composition checks

For every tile, verify:

- the label matches the visible purpose;
- the primary subject is neither clipped nor hidden by unintended foreground geometry;
- at least one stable landmark provides orientation;
- scale can be judged from nearby architecture or props;
- the target is not so close that the camera begins inside geometry;
- perspective distortion is intentional and not compensating for a poor position;
- adjacent shots add information instead of repeating the same angle.

When a contact-sheet camera reveals a problem, preserve the failing coordinates until the scene change is verified. That makes the before-and-after comparison meaningful.

The development writer overwrites a same-named sheet. Copy the inspected baseline to a clearly labeled `-before.png` artifact before rendering the comparison image, then keep the camera set unchanged until the comparison is complete.

## Contact sheet versus live viewport

The contact sheet is optimized for readable reconnaissance: it lifts ambient light, suppresses normal fog, and skips final presentation passes. Use it for coverage, geometry, and composition.

The live `.viewport` is the authority for shipping lighting, fog, post-processing, HUD, flashlight, and player-height feel. Match a fixed shot approximately when useful, but do not imply the two render paths are pixel-equivalent.

## Stability risks

Call out any tile whose evidence depends on:

- physics settling;
- AI or rat position;
- water animation;
- flicker, random effects, or CCTV update timing;
- flashlight state;
- asynchronous asset loading.

If timing is the behavior under test, use the QA playtest or visual harness. Do not hide nondeterminism behind a carefully timed manual capture.
