# Bot playtest checklist

- Decision is explicit: added, updated, run, or skipped.
- The script opens `/`, calls `__devLock(true)`, and records `__playerPos()`.
- Inputs express DEADWATER verbs: movement, jump, use, hotbar, carry/throw, flashlight, or crowbar as relevant.
- Start pose and each teleport are recorded.
- Movement distance exceeds a declared threshold for held input.
- Collision probes cover changed boundaries and return finite positions.
- Light-slot snapshots stay within the current `MAX_LIGHTS` capacity and release temporary flashlight slots.
- The run covers the changed zone and interaction, not arbitrary key mashing.
- Console errors, page errors, failed requests, and assertion failures are empty.
- Softlock windows are based on unchanged player position during intended movement, not frame-rate guesses.
- Headless timings are labeled functional evidence, not GPU performance evidence.
- JSON result, trace/video policy, commands, seed or nondeterministic systems, and skipped behaviors are reported.
