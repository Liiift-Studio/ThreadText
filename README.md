# threadText

**Render any text as photorealistic, procedural satin-stitch embroidery — in real time, in the browser, from the font's actual glyph geometry.**

> Status: **shipped.** Published to npm (`@liiift-studio/threadtext`) with a framework-agnostic
> core (`createThreadText`), a React hook + component, Framer and Webflow ports, tests, and a
> live landing site at [threadtext.com](https://threadtext.com) (demo font: the OFL Fraunces
> variable). The original single-file reference renderer lives in
> [`demo/index.html`](./demo/index.html) as the visual oracle; tool-build conventions are in the
> monorepo [`../GUIDE.md`](../GUIDE.md).

Homepage: [threadtext.com](https://threadtext.com) · npm: `@liiift-studio/threadtext`

---

## What it is

Give it a word set in any loaded (variable) font and it renders it as **raised satin floss on a transparent ground** — threads that run *across* each stroke and fan around the curves, lifted into 3D, and sewn in one satin stitch at a time. Drop it over any background. It's photorealistic **by construction** (real thread geometry + lighting), not a raster filter and not an AI image.

## Why it's worth building (the niche is empty)

A survey of the field (embroidery-digitizing software, JS libraries, mockup generators, CSS tricks, creative-coding shaders, AI generators, and the graphics literature) found **no existing tool that does all of**: real-time · arbitrary text from a font · procedural (no pre-baked assets) · photorealistic satin · in a plain browser. Every existing thing drops at least one pillar:

- **Digitizing software** (Ink/Stitch, PEmbroider, Wilcom/Hatch **TrueView**) — real stitch logic, but desktop, machine-file-oriented; previews are schematic (TrueView's photoreal render is an exported still, not live procedural web).
- **The one close browser lib** (`p5.embroider`) — right platform, but alpha & non-photoreal.
- **Fakes** (Photoshop actions, Placeit/Printful mockups, CSS, AI diffusion "embroidery" generators) — raster or generative, not procedural-from-font, not real-time-relightable.
- **Research/shaders** (Chen–McCool–Kitamoto 2012; Blender knit shaders; Shadertoy stitch patterns) — closest ideas, but not text-from-font, not browser, and either non-photoreal or non-real-time.

Defensible novelty to lead with: **(a)** font/variable-font glyph geometry drives the stitch flow field, **(b)** photoreal-by-construction (not AI, not a raster filter), **(c)** fully real-time + relightable + animated in a plain browser with zero pre-baked assets. (Full source list in `HANDOFF.md`.)

## Run the demo

It's a single self-contained file — no build step:

```bash
# from this folder
python3 -m http.server 8080
# open http://localhost:8080/demo/
```

Type to embroider a new word · Backspace to unpick · Enter to replay the sew-in · move the cursor for the sheen.

> The demo font (`demo/DaithVF.woff2`) is **Darden Studio proprietary** — fine for local dev, but **swap it for a freely-licensed variable font before this repo is made public or published.** The renderer works with any loaded font.

## How it works (one paragraph)

Rasterise the glyphs → compute a signed-distance field → derive a **flow field** (smoothed in double-angle orientation space so opposite edge-normals reinforce) so threads run across each stroke → lay thousands of discrete pre-shaded **thread sprites** oriented by the flow → lift to 3D with a dome-shade/normal map on a transparent ground → **sew it in** one BFS cross-row at a time (the needle follows the stroke) → a subtle cursor-driven sheen. Full walkthrough with line references in `HANDOFF.md`.

## Use it (extracted API)

```ts
import { createThreadText } from '@liiift-studio/threadtext'

// Load the face first (any @font-face / next/font / CSS Font Loading API), then:
const thread = createThreadText(document.getElementById('host'), {
  text: 'Thread',
  font: '"Your Font", Georgia, serif',
  weight: 680,
})

thread.setText('Threads')           // re-fit to width and redraw instantly (no sew-in)
thread.update({ threadColor: '#e6c200', fill: 0.8 }) // live changes — instant, no re-sew
thread.replay()                     // re-run the sew-in animation
thread.resize()                     // re-fit to the container
thread.focus()                      // focus the surface for typing (editable mode)
thread.destroy()                    // cancel rAF, remove listeners, free canvases
```

React:

```tsx
import { ThreadText } from '@liiift-studio/threadtext'

<ThreadText text="Thread" font='"Your Font", serif' weight={680} />
```

Thread colour, `fill` (size — the word re-fits to the container width on load/resize),
`weight`, `font`, `sewStyle` (`'machine'` satin rows or `'hand'` — a single thread that
wanders stitch by stitch), `sewRate`, `sheen`, `animate`, and `editable` (type straight on
the artwork — backed by a real input, so touch keyboards and IME work) with an `onTextChange`
callback are all options — see `ThreadTextOptions`. Change any of them live with
`instance.update(...)` — it redraws instantly, never re-running the sew-in. `react`/`react-dom`
are optional peers; the core is framework-free.

## What's next

Now shipped. Remaining ideas (see `HANDOFF.md`): region-limit or move the per-keystroke geometry
rebuild to a Web Worker/WASM (it currently re-runs the full distance-transform pipeline on every
edit); real variable-font axis control (`opsz`/`wght`) via path-based glyph rendering, since canvas
`fillText` can't set `font-variation-settings`; and additional stitch modes (chain, cross, running).

---

Part of [type-tools](https://github.com/Liiift-Studio/type-tools) by [Liiift Studio](https://liiift.studio). MIT (intended).
