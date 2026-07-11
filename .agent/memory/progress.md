# Progress — stitchType

## Works today
- Photorealistic real-time satin embroidery of any word in any loaded font (`demo/index.html`).
- Flow-field-directed threads (fan around curves, no moiré), 20-bucket shaded thread sprites, dome-shade 3D, procedural woven fabric + contact shadow, subtle cursor sheen.
- Interactive: type to recompose, Backspace unpicks, Enter replays; blinking caret.
- Sew-in animation: one satin cross-row at a time, needle following each stroke (BFS layers).
- Passed a multi-agent code review; those fixes are in the demo (rAF teardown, Math.imul hashing, cached fabric + willReadFrequently, reduced-motion, aria-live, focus mgmt).

## Extracted (2026-07-11)
- [x] Framework-agnostic `src/core/threadText.ts` — `createThreadText()` factory, typed API.
- [x] `src/core/types.ts` — `ThreadTextOptions`, `ThreadTextInstance`, `THREAD_TEXT_CLASSES`.
- [x] React hook + component (`src/react/useThreadText.ts`, `ThreadText.tsx`).
- [x] Vite/vitest/tsconfig bootstrap; `src/index.ts` public exports.
- [x] Tests (10 passing: pure math + lifecycle, canvas-2D stub for happy-dom).
- [x] Verified: lint clean, tests 10/10, build → ESM + CJS + `.d.ts`.

## Framer + Webflow (2026-07-11)
- [x] `src/framer/ThreadText.tsx` — Framer code component (property controls, RenderTarget
  gating, imperative core via esm.sh). `@ts-nocheck` (imports `framer` + a CDN URL) so
  `tsc --noEmit` stays clean. NOTE: its esm.sh pin (`@0.0.1`) needs npm publish first.
- [x] `src/webflow/embed.ts` — auto-inits `[data-threadtext]`, reads `data-tt-*`, sets
  role=img/aria-label, exposes `window.ThreadText` {init, destroy}. `vite.webflow.config.ts`
  → `dist/threadtext.webflow.min.js` (IIFE). `build:webflow` + `prepublishOnly` wired.
- [x] Tests: `src/__tests__/webflow.test.ts` (4). Total 14 passing. lint clean, both builds green.

## Landing site + ship (2026-07-11)
- [x] Published `@liiift-studio/threadtext@0.0.1` to npm (unblocks the Framer esm.sh pin).
- [x] Landing site under `site/` (cloned from floodText/site): hero, live embroidery Demo
  (imperative `createThreadText` + controls), how-it-works, usage, options table, PortsSection,
  footer. Theme = threadText indigo (hue 268). Demo font = **Fraunces** (OFL variable,
  self-hosted `site/public/fonts/Fraunces.woff2`, latin subset). OG image + stitch favicon.
- [x] Added `threadText` to `scripts/sync-sites.mjs` SUBMODULES (parent).
- [x] Verified: `next build` clean (TS + static gen); `next start` serves 200 with correct
  title/OG(png)/sitemap/icon; no SSR errors.

## Left to build (see ../HANDOFF.md)
- [ ] `vercel.json`, `.claude/`, and the shared site-kit files (via parent `npm run sync`).
- [ ] Landing site (Next.js) with a free-licensed demo font.
- [ ] Register as a type-tools submodule; npm publish; Vercel deploy.
- [ ] Perf: region-limit or Worker/WASM the per-keystroke geometry rebuild.
- [ ] Mobile/touch story.
- [ ] Optional: additional stitch modes; real VF-axis control (path-based glyphs).

## Known issues
- Per-keystroke rebuild recomputes the whole canvas (main cost).
- Tiny residual swirl at some bowl centres; BFS cross-row can span forks momentarily.
- No `opsz`/VF-axis control via canvas `ctx.font` (numeric weight only).
- Demo font proprietary (swap before publish).
