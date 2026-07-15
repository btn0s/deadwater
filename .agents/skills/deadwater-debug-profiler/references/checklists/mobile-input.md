# DEADWATER mobile and pointer-capability checklist

- Confirm whether coarse pointer, missing `requestPointerLock`, or `?mobile` triggered the mobile gate.
- Verify the gate instead of expecting touch gameplay; the current game requires mouse and keyboard.
- Check the gate Canvas CSS size, drawing buffer, camera drift, copy fit, and share action.
- Check pointer-lock requests originate from a user click on the active desktop Canvas.
- Check `pointerlockchange` updates both player lock and overlay state.
- Check keys clear on lock loss and pointer listeners release on blur, visibility change, and unmount.
- Use `__devLock` only to isolate gameplay in a browser without pointer lock, then retest real lock on a capable desktop browser.
- Verify portrait and landscape gate layout, coarse-pointer emulation, and `?mobile` preview.
- Do not add touch controls as a bug workaround without a deliberate mobile control design.
