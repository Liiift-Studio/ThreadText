# threadText

**Render any text as photorealistic, procedural satin-stitch embroidery — in real time, in the browser, from the font's actual glyph geometry.**

Homepage: [threadtext.com](https://threadtext.com) · npm: [`@liiift-studio/threadtext`](https://www.npmjs.com/package/@liiift-studio/threadtext)

Framework-agnostic core (`createThreadText`), a React hook + component, and Framer / Webflow ports. Zero required dependencies; `react`/`react-dom` are optional peers.

---

## What it is

Give it a word set in any loaded (variable) font and it renders it as **raised satin floss on a transparent ground** — threads that run *across* each stroke and fan around the curves, lifted into 3D, and sewn in one satin stitch at a time. Drop it over any background. It's photorealistic **by construction** (real thread geometry + lighting), not a raster filter and not an AI image.

## How it works

Rasterise the glyphs → compute a signed-distance field → derive a **flow field** (smoothed in double-angle orientation space, so opposite edge-normals reinforce) so threads run across each stroke → lay thousands of discrete pre-shaded **thread sprites** oriented by the flow → lift to 3D with a dome-shade / normal map on a transparent ground → **sew it in** one cross-row at a time → a subtle cursor-driven sheen. The heavy geometry pass runs in a Web Worker (with a synchronous fallback), so typing stays smooth.

## Use it

```ts
import { createThreadText } from '@liiift-studio/threadtext'

// Load the face first (any @font-face / next/font / CSS Font Loading API), then:
const thread = createThreadText(document.getElementById('host'), {
  text: 'Thread',
  font: '"Your Font", Georgia, serif',
  weight: 680,
})

thread.setText('Threads')                            // re-fit to width and redraw instantly
thread.update({ threadColor: '#e6c200', fill: 0.8 }) // live changes — instant, no re-sew
thread.replay()                                      // re-run the sew-in animation
thread.resize()                                      // re-fit to the container
thread.destroy()                                     // cancel rAF, remove listeners, free canvases
```

React:

```tsx
import { ThreadText } from '@liiift-studio/threadtext'

<ThreadText text="Thread" font='"Your Font", serif' weight={680} />
```

### Options

All fields on `ThreadTextOptions` — change any of them live with `instance.update(...)` (it redraws instantly, without re-running the sew-in):

- **`text`** — the word to embroider.
- **`font`** — CSS `font-family` of an already-loaded font; its glyph geometry drives the stitch flow.
- **`weight`** — numeric font weight (drives the `wght` axis via the standard font shorthand).
- **`axes`** — variable-font axes, e.g. `{ opsz: 40, SOFT: 60 }`, applied via canvas `fontVariationSettings` (Chrome/Edge/Safari); ignored where unsupported.
- **`threadColor`** — floss colour.
- **`fill`** — size: the fraction of the container width the word spans (it re-fits on load/resize).
- **`stitchMode`** — `'satin'` · `'cross'` · `'chain'` · `'running'` textures.
- **`sewStyle`** — `'machine'` (satin rows in parallel) or `'hand'` (one letter at a time, widest threads near the top first, thin edges last).
- **`sewRate`** · **`animate`** — sew-in speed and whether it plays.
- **`sheen`** — cursor-following highlight.
- **`editable`** + **`onTextChange`** — make the surface typeable (backed by a real `<input>`, so touch keyboards and IME work).

---

Part of [type-tools](https://github.com/Liiift-Studio/type-tools) by [Liiift Studio](https://liiift.studio). MIT.
