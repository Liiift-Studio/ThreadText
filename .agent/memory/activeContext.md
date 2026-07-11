# Active Context — threadText

Last updated: 2026-07-11

## Name
Tool is now **threadText** (was the placeholder "stitchType"). npm
`@liiift-studio/threadtext`, domain **threadtext.com** (owned, on Vercel), GitHub repo
`Liiift-Studio/ThreadText`. The monorepo **folder is still `stitchType/`** until the
submodule path is renamed (fiddly parent rewiring — pending).

## Current focus
First extraction slice **done**: the demo renderer is now a typed, framework-agnostic
package (`src/`) with React bindings and tests. Build + typecheck + tests all green.
`demo/index.html` remains the visual oracle.

## Done in this slice
- Bootstrap: `package.json` (`@liiift-studio/threadtext` 0.0.1), `vite.config.ts`,
  `vitest.config.ts`, `tsconfig.json` — matched against `../floodText`.
- Core: `src/core/types.ts` (`ThreadTextOptions`, `ThreadTextInstance`,
  `THREAD_TEXT_CLASSES` → `tt-bg`/`tt-fx`) and `src/core/threadText.ts` — the demo's
  module globals lifted into a `createThreadText()` factory returning
  `{ setText, replay, resize, destroy, text }`. Pure helpers (`hash2`, `vnoise`,
  `distanceInside`, `boxBlur`, `parseColor`) exported for testing. Algorithm math is
  byte-for-byte the demo's; new options: font/weight/threadColor/fabricColor/pitch/
  animate/sewRate/sheen/reducedMotion/aspect.
- React: `src/react/useThreadText.ts` (structural-key remount + text→setText delta
  routing + ResizeObserver) and `src/react/ThreadText.tsx` (forwardRef, role="img",
  aria-label defaults to text).
- Tests: `src/__tests__/threadText.test.ts` — 10 passing (pure math + lifecycle with a
  canvas-2D stub; happy-dom has no canvas backend).
- Verified: `npm run lint` clean, `npm run test:run` 10/10, `npm run build` → ESM+CJS+dts.
- Registered as a type-tools submodule; pushed to `Liiift-Studio/ThreadText`.

## Immediate next steps (see ../HANDOFF.md §6)
1. Rename the monorepo folder `stitchType/` → `threadText/` (submodule path rewiring).
2. Framer + Webflow bindings (`src/framer/ThreadText.tsx`, `src/webflow/embed.ts`).
3. Landing site under `site/` (Next.js) with a **free-licensed** VF (demo font is
   Darden-proprietary — HANDOFF §7).
4. npm publish + Vercel deploy (domain threadtext.com already owned).
5. Perf: region-limit or Worker/WASM the per-keystroke geometry rebuild (HANDOFF §4.1).

## Decisions on record
- Keep **individual threads visible** — a WebGL anisotropic "silk" relight was tried and reverted because it washed the threads out (HANDOFF §4.3).
- Discrete thread sprites on an orientation-smoothed SDF flow field (double-angle space) — this is the core technique; it avoids the moiré that per-pixel sinusoid stripes produce.
- `dt` clamp 0.25s so the sew-in stays wall-clock-paced on throttled tabs.

## Blockers / watch-outs
- Per-keystroke full-canvas rebuild is the main perf cost — region-limit or Worker/WASM it before shipping (HANDOFF §4.1).
- Demo font is proprietary — swap before publishing (HANDOFF §7).
