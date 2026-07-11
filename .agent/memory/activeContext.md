# Active Context — stitchType

Last updated: 2026-07-10 (handoff seed)

## Current focus
Fresh tool, seeded for handoff. The working renderer is in `demo/index.html`; nothing has been extracted into the package structure yet.

## Immediate next steps (see ../HANDOFF.md §6)
1. Read `../GUIDE.md` (monorepo tool conventions) + skim `demo/index.html`.
2. Bootstrap the package (package.json/vite/tsconfig/vercel/.claude) against a sibling (`../floodText`).
3. Extract `src/core/stitchType.ts` per the proposed API in `HANDOFF.md` §5, using the demo as the visual oracle.
4. React hook + component (the Darden React port `daithHero.js` on branch `feature/gamay-hero-explorations` in Darden-Studio is a working effect/cleanup template).
5. Framer + Webflow bindings, tests, landing site, ship.

## Decisions on record
- Keep **individual threads visible** — a WebGL anisotropic "silk" relight was tried and reverted because it washed the threads out (HANDOFF §4.3).
- Discrete thread sprites on an orientation-smoothed SDF flow field (double-angle space) — this is the core technique; it avoids the moiré that per-pixel sinusoid stripes produce.
- `dt` clamp 0.25s so the sew-in stays wall-clock-paced on throttled tabs.

## Blockers / watch-outs
- Per-keystroke full-canvas rebuild is the main perf cost — region-limit or Worker/WASM it before shipping (HANDOFF §4.1).
- Demo font is proprietary — swap before publishing (HANDOFF §7).
