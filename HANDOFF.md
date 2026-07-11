# stitchType — Handoff

For the next agent/developer picking this up. Read this, then skim [`demo/index.html`](./demo/index.html) (the working renderer) and the monorepo build conventions in [`../GUIDE.md`](../GUIDE.md).

---

## 1. Where this came from

Built as a hero exploration for Darden Studio's Daith typeface (the "embroidered word" direction), iterated to a photorealistic, real-time, procedural satin-stitch renderer. It outgrew the hero and is worth its own type-tools tool. The Darden-side prototype history lives on branch `feature/gamay-hero-explorations` in the `Darden-Studio` repo (`sites/darden/prototypes/gamay-hero/hero-embroidery.html`); **`demo/index.html` here is a verbatim copy of the latest, verified-working version.**

It passed a multi-agent code review (correctness / graphics / animation / a11y / perf) and the fixes are already in this copy (rAF-loop teardown, `Math.imul` hashing, cached fabric + `willReadFrequently`, reduced-motion, aria-live, focus handling, etc.).

## 2. Current state

- ✅ **Renderer works** and looks photoreal (verified in-browser). Any loaded font, any word.
- ✅ Real-time: flow field, thread sprites, dome-shade 3D, woven fabric, contact shadow, cursor sheen.
- ✅ Interactive: type to recompose the word; Backspace unpicks; Enter replays; caret; sound toggle removed here (that was book-page only).
- ✅ **Sew-in animation**: lays one satin cross-row at a time, the needle following each stroke (BFS layers from each stroke's top-left).
- ❌ **Not extracted** into a reusable/typed API — it's one inlined `<script>` with module-level globals.
- ❌ No React / Framer / Webflow bindings, no tests, no landing site, not published.
- ❌ Demo font is proprietary (see §7).

## 3. Architecture of the reference renderer (`demo/index.html`)

All in the single inline `<script>`. Two stacked canvases: `#bg` (fabric + baked stitches) and `#fx` (cursor sheen, `mix-blend: screen`). Pipeline, in order:

1. **`computeSize()`** — canvas backing size = CSS size × DPR, capped (area budget) for a responsive per-keystroke rebuild.
2. **Noise** — `hash2` (now `Math.imul`-based, 32-bit-safe) + `vnoise`.
3. **`buildSprites()`** — pre-renders **20 brightness variants** of one rounded satin-thread sprite (a shaded "tube" with soft ends + a faint 2-ply twist groove). Quantising to 20 buckets avoids banding.
4. **`build()`** — the geometry pass for the current word:
   - rasterise the word (`fillText`) into a reused offscreen (`OFFCV`), read alpha → **frayed binary mask**;
   - **`distanceInside()`** — exact Euclidean distance transform (Felzenszwalb–Huttenlocher), two-pass;
   - **orientation field** — gradient of the smoothed distance, encoded as double-angle `(cos2θ, sin2θ)`, **box-blurred**, decoded back to per-pixel thread direction `EX/EY`. (Double-angle is the trick that makes opposite edge-normals reinforce instead of cancel → clean parallel threads that fan on curves, no moiré.)
   - **`SHADE`** dome-shade/AO map (raised 3D look), plus `MASKCV` (sheen clip) and `SHADOWCV` (contact shadow).
5. **`allocForSize()`** — bakes the **static woven fabric once** into `FABRIC_CV` (big per-keystroke win; was a full `getImageData`/loop/`putImageData` every key) and allocates the reused `OFFCV` glyph-raster scratch (both `willReadFrequently`).
6. **`buildStitchList()`** — samples the mask on a jittered grid; each inside sample → a stitch `{x, y, ang (=atan2(EY,EX)), idx (brightness bucket)}`. Sorted by x (for `leftX`/`rightX` bounds only).
7. **`buildSewRows(subset)`** — **the sew order**: a spatial-hash BFS over the stitches; each BFS layer = one satin cross-row. Seeds are the (x+y)-min stitch of each connected component → the needle starts top-left of each stroke and advances along it, turning with the stroke. Letters are processed left→right.
8. **`startReveal()` / `drawRowsTo()` / `loop(ts)`** — reveal rows over time (rate = rows/sec; `dt` clamped to 0.25 so it stays wall-clock-paced even on throttled/low-fps tabs). `resetBg()` draws cached fabric + shadow, then rows are appended.
9. **`drawSheen()`** — subtle cursor-driven radial highlight on `#fx`, clipped to the glyph via `destination-in` + `MASKCV`.
10. **Typing** — `recompose()` rebuilds geometry and animates only the newly-typed letter (fixed `FS`/`ANCHOR_X` from `calibrate()` so letters don't reflow); `updateCaret()` positions a DOM caret.

## 4. Known issues / limitations (carry forward)

1. **Per-keystroke cost.** `build()` re-runs the full EDT + double-angle blur over the whole canvas on every keystroke — the dominant cost. Mitigated (cached fabric, reused scratch, lower res) but **not region-limited**. Real fix: compute only the changed letter's bounding box, or move geometry to a Web Worker / WASM. This is the #1 thing to fix for a shippable tool.
2. **Book-page vs embroidery.** This demo is the embroidery renderer. There was a *sibling* WebGL "strike-on book page" (now living in the Darden site as `daithHero`) — **not** part of this tool; ignore it.
3. **WebGL relight was tried and reverted.** An earlier version relit the baked thread G-buffer in a WebGL shader with an anisotropic (Kajiya–Kay) sheen that swept with the cursor. Quinn preferred the version where **individual threads are clearly visible** (the current canvas bake) over the WebGL "silk" look. If you revisit real-time relighting, keep thread legibility — layer a *subtle* anisotropic pass over the visible-thread bake, don't replace it.
4. **Residual swirl** at a couple of tight bowl centres (index-½ singularities of the orientation field). Acceptable; discrete sprites hide most of it.
5. **BFS cross-row at forks** can momentarily sew two disconnected arms at once (a layer that reaches two branches). Minor.
6. **Touch**: keyboard-only (no on-screen keyboard trigger); pointer-only sheen. Needs a mobile story.
7. **No `opsz` control** — canvas `ctx.font` can't set `font-variation-settings`; only numeric weight is used. If the tool should honour VF axes, render glyph paths via `opentype.js`/`fontkit` instead of canvas `fillText`.

## 5. Proposed core API (for the extraction — Phase 3 of GUIDE.md)

Follow the GUIDE's "invariant pattern". Suggested framework-agnostic surface:

```ts
// src/core/stitchType.ts
export interface StitchOptions {
  text: string;
  font: string;            // CSS font-family of an already-loaded font
  weight?: number;         // 100–900
  threadColor?: string;    // floss colour (default warm white)
  fabricColor?: string;    // ground (default near-black linen)
  pitch?: number;          // thread spacing (px)
  animate?: boolean;       // sew-in on mount
  sewRate?: number;        // satin rows / second
  sheen?: boolean;         // cursor-follow sheen
  reducedMotion?: boolean; // auto-detected if omitted
}

export interface StitchInstance {
  setText(text: string): void;     // re-embroider (animates the delta)
  replay(): void;                   // full sew-in again
  resize(): void;                   // re-fit to the container
  destroy(): void;                  // cancel rAF, remove listeners, free canvases
}

// Takes a container (creates its own canvases) OR an existing canvas.
export function createStitchText(target: HTMLElement, opts: StitchOptions): StitchInstance;
```

Extraction = lift the demo's functions into this module, replace module-level globals with instance state, replace `document.getElementById` with the passed element/created canvases, and expose the methods above. The demo's teardown logic (already present in the Darden React port `daithHero.js`) is a good template for `destroy()`.

## 6. Step-by-step to finish (map to `../GUIDE.md`)

1. **Bootstrap** (GUIDE Phase 2): `package.json` (`@liiift-studio/stitchtype`), `vite.config.ts`, `vite.webflow.config.ts`, `vitest.config.ts`, `tsconfig.json`, `vercel.json`, `.claude/`, register as a submodule (`git submodule add git@github-liiift:Liiift-Studio/StitchType.git stitchType` after creating the GitHub repo). A stub `package.json` is here already — flesh it out against a sibling (`floodText/package.json`).
2. **Core** (Phase 3): extract `src/core/stitchType.ts` per §5; keep the demo as the visual oracle.
3. **React** (Phase 4): `src/react/StitchType.tsx` + `useStitchType.ts` (animated-tool rAF pattern). The Darden `daithHero.js` port is a working reference for the effect + cleanup.
4. **Framer / Webflow** (Phase 4): `src/framer/StitchType.tsx`, `src/webflow/embed.ts`.
5. **Tests** (Phase 5): happy-dom + the mock pattern; cover empty text, resize, destroy, reduced-motion, delta-animate.
6. **Site** (Phase 6): Next.js landing under `site/` with a live demo; swap the demo font for a free VF.
7. **Ship** (Phase 8): version, npm publish, Vercel deploy, update the type-tools parent pointer.

## 7. Licensing (do before publishing)

`demo/DaithVF.woff2` is **Darden Studio proprietary**. It's fine locally, but **replace the demo/site font with a freely-licensed variable font** (e.g. an OFL Google variable font) before this repo is public or published. The renderer is font-agnostic — nothing depends on Daith specifically.

## 8. Open questions for Quinn

- Final **name** (stitchType is a placeholder).
- **Scope**: satin-stitch only, or also chain/cross/running stitch as modes?
- **VF axes**: do we need real `opsz`/`wght` axis control (→ path-based glyph rendering) or is numeric-weight canvas rendering enough?
- Colours/materials as first-class options (thread + fabric palettes)?

---

## Research appendix — the niche is empty

No existing tool does {real-time + arbitrary font text + procedural + photoreal satin + browser}. Buckets that each miss it: digitizing software (PEmbroider, Ink/Stitch, Wilcom/Hatch TrueView — desktop/machine-file, previews schematic or exported stills); the one close browser lib `p5.embroider` (alpha, non-photoreal); fakes (Photoshop actions, Placeit/Printful mockups, CSS, AI diffusion generators — raster/generative); research/shaders (Chen–McCool–Kitamoto GI 2012; Blender Knittr; Shadertoy stitch patterns — not text-from-font / not browser / not real-time-photoreal). Sources: github.com/CreativeInquiry/PEmbroider, github.com/nkymut/p5.embroider, hatchembroidery.com, graphicsinterface.org/proceedings/gi2012/gi2012-17.
