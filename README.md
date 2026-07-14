# threadText

**Render any text as photorealistic, procedural satin-stitch embroidery — in real time, in the browser, from the font's actual glyph geometry.**

[![npm](https://img.shields.io/npm/v/@liiift-studio/threadtext.svg)](https://www.npmjs.com/package/@liiift-studio/threadtext)
[![license](https://img.shields.io/npm/l/@liiift-studio/threadtext.svg)](./LICENSE)
![types](https://img.shields.io/badge/types-included-blue.svg)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
![gzip](https://img.shields.io/badge/gzip-~9%20kB-brightgreen.svg)

Homepage: **[threadtext.com](https://threadtext.com)** (live, interactive demo) · npm: [`@liiift-studio/threadtext`](https://www.npmjs.com/package/@liiift-studio/threadtext)

Framework-agnostic core (`createThreadText`), a React hook + component (`useThreadText` / `<ThreadText>`), and Framer / Webflow ports. Zero required dependencies; `react`/`react-dom` are optional peers.

> **See it move.** The effect is animated (it sews itself in stitch-by-stitch) and cursor-reactive, so a still can't fully show it — the [**live demo at threadtext.com**](https://threadtext.com) is the fastest way to judge it.
>
> <!-- Visual assets (hero still, sew-in GIF, stitch-mode grid) are added under /assets and embedded here once the repo is public — see "Development". -->

---

## What it is

Give it a word set in any loaded (variable) font and it renders it as **raised satin floss on a transparent ground** — threads that run *across* each stroke and fan around the curves, lifted into 3D, and sewn in one satin stitch at a time. Drop it over any background. It's photorealistic **by construction** (real thread geometry + lighting), not a raster filter and not an AI image.

It's built for **single words / short display type** — a hero word, a logotype, a stitched headline — not body copy.

## How it works

Each step below is what actually produces the thread look — the plain-language idea first, the precise technique in parentheses:

1. **Draw the glyphs** to an offscreen canvas from the loaded font (rasterise; variable-font axes applied via canvas `fontVariationSettings`).
2. **Measure how deep inside each stroke every pixel is** (an exact Euclidean *signed-distance field*).
3. **Work out which way the thread should run** — always *across* the stroke, fanning smoothly around curves (a *flow field*, smoothed in double-angle orientation space so the two opposite edges of a stroke agree instead of cancelling).
4. **Lay the stitches** by stamping many small, pre-lit thread images along that flow (a reused set of *pre-shaded thread sprites* — ~20 brightness variants placed as thousands of individual stitches).
5. **Lift it into 3D** so each thread catches light and casts a soft crease (a *dome-shade / normal map* over the transparent ground).
6. **Sew it in** one cross-row at a time as an animation, and add a **subtle cursor-driven sheen** as you move over it.

The heavy geometry pass (steps 2–5) runs in a **Web Worker** so typing and live edits stay smooth; where a Worker isn't available it falls back to running synchronously on the main thread (see [Requirements](#requirements--browser-support)).

## Use it

```ts
import { createThreadText } from '@liiift-studio/threadtext'

// Declare the face (any @font-face / next/font / CSS Font Loading API) — the core
// waits for it to load before drawing, so you don't have to await it yourself.
const host = document.getElementById('host')
if (host) {
  const thread = createThreadText(host, {
    text: 'Thread',
    font: '"Your Font", Georgia, serif',   // glyph geometry drives the stitch flow
    weight: 680,
  })

  thread.setText('Threads')                            // re-fit to width and redraw instantly
  thread.update({ threadColor: '#e6c200', fill: 0.8 }) // live changes — instant, no re-sew
  thread.replay()                                      // re-run the sew-in animation
  thread.resize()                                      // re-fit to the container
  thread.destroy()                                     // cancel rAF, remove listeners, free canvases
}
```

The host element needs a resolved width — the word is fitted to `host.getBoundingClientRect().width`. `createThreadText` is **SSR-safe**: called without a DOM it returns an inert no-op handle, so it won't crash a server render.

### React

```tsx
import { ThreadText } from '@liiift-studio/threadtext'

<ThreadText text="Thread" font='"Your Font", serif' weight={680} />
```

**Next.js / App Router:** the React entry uses `useRef`/`useLayoutEffect`, so it's a Client Component — put `'use client'` at the top of the file that imports `<ThreadText>` (or your own wrapper). The framework-agnostic core is SSR-safe on its own; only the React bindings need the client boundary.

For a custom container or your own imperative control, use the hook — it creates the instance, applies option changes live, and tears everything down (ResizeObserver + `destroy()`) on unmount:

```tsx
import { useThreadText } from '@liiift-studio/threadtext'

function Stitched() {
  const ref = useThreadText<HTMLDivElement>({ text: 'Thread', weight: 680, threadColor: '#e6c200' })
  return <div ref={ref} style={{ width: '100%' }} />
}
```

### Framer & Webflow

**Framer** — add [`src/framer/ThreadText.tsx`](./src/framer/ThreadText.tsx) as a code component (Insert → Code → New Component, or host it and add by URL). It imports the core straight from `esm.sh`, so there's no build step, and every option is exposed as a Framer property control.

**Webflow** — drop the self-contained embed bundle (no React, no module loader) into an Embed element and mark any element with `data-threadtext`:

```html
<script src="https://unpkg.com/@liiift-studio/threadtext/dist/threadtext.webflow.min.js"></script>

<div data-threadtext
     data-tt-text="Thread"
     data-tt-font='"Your Font", serif'
     data-tt-weight="680"
     data-tt-thread-color="#e6c200"
     data-tt-stitch-mode="satin"
     data-tt-sew-style="machine"></div>
```

The bundle auto-initialises every `[data-threadtext]` element and exposes a small `window.ThreadText` API for manual control. Supported attributes: `data-tt-text`, `data-tt-font`, `data-tt-weight`, `data-tt-thread-color`, `data-tt-fill`, `data-tt-pitch`, `data-tt-stitch-mode`, `data-tt-sew-style`, `data-tt-sew-rate`, `data-tt-sheen`, `data-tt-animate`, `data-tt-editable`, `data-tt-axes` (JSON).

---

## Options

All fields on `ThreadTextOptions`. Most can be changed live with `instance.update(...)` — colour, font, weight, size (`fill`), pitch, stitch mode, sew style/rate, sheen, axes and editability all redraw instantly without re-running the sew-in. Two exceptions: **`text`** changes go through `instance.setText(...)`, and **`reducedMotion`** is fixed at construction (changing it recreates the instance).

- **`text`** — the word to embroider.
- **`font`** — CSS `font-family` of an already-loaded font; its glyph geometry drives the stitch flow.
- **`weight`** — numeric font weight (drives the `wght` axis via the standard font shorthand).
- **`axes`** — variable-font axes, e.g. `{ opsz: 40, SOFT: 60 }`, applied via canvas `fontVariationSettings` (Chrome/Edge/Safari); ignored where unsupported.
- **`threadColor`** — floss colour.
- **`fill`** — size: the fraction of the container width the word spans (it re-fits on load/resize).
- **`pitch`** — thread spacing (how tightly the stitches are packed across each stroke).
- **`stitchMode`** — `'satin'` · `'cross'` · `'chain'` · `'running'` textures.
- **`sewStyle`** — `'machine'` (satin rows in parallel) or `'hand'` (one letter at a time, widest threads near the top first, thin edges last).
- **`sewRate`** · **`animate`** — sew-in speed and whether it plays.
- **`reducedMotion`** — force-skip the sew-in animation and draw the finished piece in one frame (also honoured automatically when the OS `prefers-reduced-motion` is set).
- **`sheen`** — cursor-following highlight.
- **`editable`** + **`onTextChange`** — make the surface typeable (backed by a real `<input>`, so touch keyboards and IME work). Call `instance.focus()` to focus it programmatically.

---

## Requirements & browser support

- **Canvas 2D** — required. The whole render is drawn to stacked `<canvas>` elements.
- **Web Worker + `Blob` + `URL.createObjectURL`** — used to run the geometry pass off the main thread. **Under a strict Content-Security-Policy the Worker is built from a `blob:` URL**, so you need `worker-src blob:` (or `script-src blob:`). If Worker creation is blocked or unavailable, threadText **degrades gracefully** and runs the same pass synchronously on the main thread — correct output, but heavy edits can jank on very large words.
- **`fontVariationSettings` on canvas** (Chrome/Edge/Safari) — needed only for the `axes` option; feature-detected and skipped where unsupported.
- **`prefers-reduced-motion`** — honoured automatically (skips the sew-in animation).
- **Size** — ~9 kB gzipped (ESM), ~8 kB for the standalone Webflow bundle. **Zero runtime dependencies** (`react`/`react-dom` are optional peers), tree-shakeable (`sideEffects: false`).
- **Stability** — pre-1.0 (`0.x`); the option and instance API above is what's shipped, but pin the version if you depend on exact visual output.

---

## Development

This repo is a git submodule of the [type-tools](https://github.com/Liiift-Studio/type-tools) monorepo. To work on the package itself:

```bash
git clone https://github.com/Liiift-Studio/ThreadText.git
cd ThreadText
npm install
npm test            # vitest (happy-dom)
npm run build       # ESM + CJS + .d.ts  (vite)
npm run build:webflow  # standalone window.ThreadText IIFE bundle
npm run lint        # tsc --noEmit
```

Source layout:

| Path | What it is |
|---|---|
| `src/index.ts` | Public exports (`createThreadText`, `useThreadText`, `ThreadText`, `THREAD_TEXT_CLASSES`) |
| `src/core/threadText.ts` | Framework-agnostic renderer (`createThreadText`) — no React imports |
| `src/core/types.ts` | `ThreadTextOptions`, `ThreadTextInstance`, `THREAD_TEXT_CLASSES` |
| `src/react/` | `useThreadText` hook + `<ThreadText>` component |
| `src/framer/ThreadText.tsx` | Framer code component (imports core from esm.sh) |
| `src/webflow/embed.ts` | Webflow auto-init embed → `dist/threadtext.webflow.min.js` |
| `src/__tests__/` | vitest suites (core, worker assembly, webflow embed) |

The landing site + interactive demo live in `site/` (Next.js). Issues and PRs: [github.com/Liiift-Studio/ThreadText/issues](https://github.com/Liiift-Studio/ThreadText/issues).

> **Contributing note:** this repo is a submodule of the [type-tools](https://github.com/Liiift-Studio/type-tools) monorepo, and the files under `site/` config, `vercel.json`, and `.gitignore` are **auto-synced from the parent** (`type-tools/shared/`) — edits to those here are overwritten on the next sync. The package source (`src/`) and the per-tool site files (`site/src/app/page.tsx`, `Demo.tsx`, `layout.tsx`, `globals.css`) are safe to edit directly.

---

## The type-tools family

threadText is one of [**type-tools**](https://github.com/Liiift-Studio/type-tools) — a suite of small, focused typographic libraries by Liiift Studio, each doing one thing that's hard or impossible in CSS alone. A few siblings:

- [**ragtooth**](https://ragtooth.com) — deliberate sawtooth ragged-edge line breaking.
- [**floodText**](https://floodtext.com) — per-character variable-font wave animation.
- [**magnetType**](https://magnettype.com) — cursor-field per-character axis variation.
- [**opszStepper**](https://opszstepper.com) — optical-size font hot-swap by font-size.
- [**hoverBoldly**](https://hoverboldly.com) — bold-on-hover with no layout shift.

See the [full family](https://github.com/Liiift-Studio/type-tools) for all of them.

---

Part of [type-tools](https://github.com/Liiift-Studio/type-tools) by [Liiift Studio](https://liiift.studio). MIT.
