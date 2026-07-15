# DEADWATER audio workflow

## Event matrix

Write the relevant rows before producing sound:

| Event | Current key/source | Trigger owner | Frequency | Variants | Loop | Acceptance read |
| --- | --- | --- | --- | ---: | --- | --- |
| Concrete step | `step`, Kenney CC0 | `AudioSystem` distance accumulator | high | 5 | no | grounded cadence without teleport clomp |
| Landing | `land`, Kenney CC0 | grounded transition | medium | 1 | no | body weight after airtime |
| Use/relay/door | `click`, `clunk`, `door` | owning interaction | low | 1 each | no | state change is audible once |
| Carry/impact | `pickup`, `thunk` | inventory/carry owner | medium | 1 each | no | object weight and confirmation |
| Flashlight | `torch` | inventory/flashlight transition | low | 1 | no | equip or toggle is distinct |
| Crowbar swing | `swing`, synthesized | crowbar action | medium | pitch-varied | no | fast air movement before impact |
| Interior ambience | `hum`, synthesized | zone selection | continuous | 1 | yes | electrical interior bed |
| Harbor ambience | `wash`, synthesized | zone selection | continuous | 1 | yes | water movement outside |

Add new rows; do not replace this with a generic minimum asset count.

## Source decisions

Prefer existing sounds and CC0 sources. CC BY is allowed only with exact author, source URL, license URL, and credit text. Reject NC or ND material. Generated audio must record its tool, prompt, input sources, and processing and must be safe to ship under that tool's terms.

Before downloading, inspect `docs/ASSETS.md` and `public/models/CREDITS.md`. Keep audio attribution in the existing credits file until the project deliberately splits it.

## Processing recipe

For imported one-shots:

1. Keep the untouched source outside the runtime path when edits are destructive.
2. Trim leading silence without cutting the attack.
3. Remove DC offset and obvious background contamination.
4. Add a short tail fade; avoid a hard discontinuity.
5. Downmix to mono when stereo width does not matter in play.
6. Normalize a family consistently, then tune actual gain in context.
7. Encode browser assets as OGG and keep filenames stable and descriptive.
8. Record the exact command or editor operation.

For loops, audition at least ten consecutive boundaries. A low numeric seam does not prove that modulation, rhythm, or environmental motion loops naturally.

## Synthesis recipe

Simple sources are good candidates for reproducible synthesis:

- filtered noise plus a fast envelope for a whoosh;
- short noise and low sine layers for a mechanical impact;
- periodic sine layers plus low-passed noise for electrical hum;
- slowly modulated filtered noise for water wash;
- short frequency modulation for a creature chirp.

Keep the source small, deterministic when regenerated, and documented beside the code or command. Avoid building a general synthesizer when one focused buffer recipe is clearer.

## Runtime integration

`src/game/audio.ts` owns one lazy `AudioContext`, one master gain, decoded buffers, procedural buffers, the `play()` helper, and crossfaded zone ambience.

- Add imported variants to `SAMPLES`.
- Bake small procedural cues once after context creation.
- Trigger through `play()` at the state transition owner.
- Use an event or cooldown for repeated state, never an unguarded frame callback.
- Resume audio only from a valid user gesture.
- Stop and disconnect replaced loop sources after the fade.
- Handle fetch/decode failure visibly during development instead of silently claiming the cue loaded.

## Browser verification

Check the relevant subset:

- first pointer gesture unlocks without an autoplay error;
- every referenced `/sounds/` request returns successfully and decodes;
- the named interaction emits one cue per transition;
- repeated events vary without phasey stacking or excessive gain;
- steps stop in air and do not fire for teleports;
- ambience crosses between interior and harbor without stacking or a gap;
- remount, pointer-lock release/re-entry, and hidden-tab return do not duplicate beds;
- production preview resolves the same asset paths;
- browser console and network contain no audio errors.

## Report template

```text
Audio event matrix:
Source and license or synthesis/generation record:
Original files:
Processing commands:
Shipped files and formats:
Runtime keys and trigger owners:
Unlock and cleanup behavior:
Browser path exercised:
Production result:
Remaining mix or device risks:
```
