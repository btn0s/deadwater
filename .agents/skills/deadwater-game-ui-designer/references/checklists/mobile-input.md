# Mobile and coarse-pointer scope checklist

- The current product decision is explicit: DEADWATER gates coarse-pointer or pointer-lock-incompatible devices instead of offering touch gameplay.
- The `?mobile` preview flag exercises the same gate on desktop.
- The gate uses a full-screen viewport and does not distort the desktop 4:3 game.
- Copy clearly states that mouse and keyboard are required.
- Title, hint, device message, and share action fit narrow portrait and landscape screens.
- The share action supports native share when available and a stable copied fallback.
- Decorative camera or text motion respects reduced-motion preferences when the task touches motion.
- The page does not expose broken virtual controls or imply partial touch support.
- Any request to add touch gameplay first defines camera look, movement, use, carry, equipment, pause, pointer capture, cancel, safe areas, and performance scope.
- Coarse-pointer emulation and at least one real mobile browser smoke test are used when mobile behavior changes.
