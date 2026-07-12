// threadText/src/webflow/embed.ts — zero-config browser bundle for Webflow Custom Code Embed.
// Auto-initialises threadText on any element marked with [data-threadtext], reading options
// from data-* attributes, and exposes a small window.ThreadText API for manual control.
import { createThreadText } from '../core/threadText'
import type { ThreadTextOptions, ThreadTextInstance } from '../core/types'

/** Attribute that opts an element in to the embroidery renderer. */
const OPT_IN_ATTR = 'data-threadtext'

/** Per-element teardown record so destroy() can free the instance and restore markup. */
interface Instance {
	/** Live renderer handle. */
	instance: ThreadTextInstance
	/** Original innerHTML, restored on destroy. */
	originalHTML: string
}

/** Tracks live instances keyed by their element — WeakMap so removed nodes are GC'd. */
const INSTANCES = new WeakMap<HTMLElement, Instance>()

/**
 * Read threadText options from an element's data-* attributes.
 * Unset attributes fall through to the library defaults.
 *
 * Supported attributes:
 *   data-tt-text          — text to embroider (defaults to the element's text content)
 *   data-tt-font          — CSS font-family of a loaded font
 *   data-tt-weight        — numeric font weight (100–900)
 *   data-tt-thread-color  — floss colour (hex or rgb())
 *   data-tt-pitch         — thread spacing in px
 *   data-tt-fill          — fraction of the width the word fills (its size)
 *   data-tt-sew-rate      — satin rows per second
 *   data-tt-sheen         — "false" to disable the cursor sheen
 *   data-tt-animate       — "false" to draw instantly (no sew-in)
 *   data-tt-editable      — "true" to make the word typeable
 *
 * @param el - The opted-in element
 * @param fallbackText - Text to use when data-tt-text is absent
 */
function readOptions(el: HTMLElement, fallbackText: string): ThreadTextOptions {
	const d = el.dataset
	const opts: ThreadTextOptions = { text: d.ttText ?? fallbackText }

	if (d.ttFont) opts.font = d.ttFont
	if (d.ttWeight !== undefined) { const n = parseFloat(d.ttWeight); if (!isNaN(n)) opts.weight = n }
	if (d.ttThreadColor) opts.threadColor = d.ttThreadColor
	if (d.ttPitch !== undefined) { const n = parseFloat(d.ttPitch); if (!isNaN(n)) opts.pitch = n }
	if (d.ttFill !== undefined) { const n = parseFloat(d.ttFill); if (!isNaN(n)) opts.fill = n }
	if (d.ttSewRate !== undefined) { const n = parseFloat(d.ttSewRate); if (!isNaN(n)) opts.sewRate = n }
	if (d.ttSheen === 'false') opts.sheen = false
	if (d.ttAnimate === 'false') opts.animate = false
	if (d.ttEditable === 'true') opts.editable = true

	return opts
}

/**
 * Initialise a single element: snapshot its markup, expose the word to assistive tech,
 * clear it, and mount the renderer. Idempotent — re-initialising tears down the previous run.
 *
 * @param el - Element to embroider
 */
function initElement(el: HTMLElement): void {
	// Tear down any previous run so re-init doesn't stack canvases.
	destroy(el)

	const originalHTML = el.innerHTML
	const text = (el.dataset.ttText ?? el.textContent ?? '').trim()
	if (!text) return

	const options = readOptions(el, text)
	// The word is drawn on a canvas — keep it announced to screen readers.
	el.setAttribute('role', 'img')
	el.setAttribute('aria-label', text)
	el.innerHTML = ''

	const instance = createThreadText(el, options)
	INSTANCES.set(el, { instance, originalHTML })
}

/**
 * Stop and restore a single element if it has a live instance.
 *
 * @param el - Element previously initialised
 */
function destroy(el: HTMLElement): void {
	const rec = INSTANCES.get(el)
	if (!rec) return
	rec.instance.destroy()
	el.removeAttribute('role')
	el.removeAttribute('aria-label')
	el.innerHTML = rec.originalHTML
	INSTANCES.delete(el)
}

/**
 * Scan a root for opted-in elements and initialise each one.
 *
 * @param root - Element or document to search (default: document)
 */
function init(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>(`[${OPT_IN_ATTR}]`).forEach(initElement)
}

/**
 * Auto-initialise once the DOM is parsed and web fonts have loaded.
 * Fonts must settle first: the stitch flow field is rasterised from the final glyph
 * geometry, which shifts when a web font swaps in.
 */
function autoInit(): void {
	const run = () => {
		if (typeof document !== 'undefined' && document.fonts?.ready) {
			document.fonts.ready.then(() => init()).catch(() => init())
		} else {
			init()
		}
	}
	if (typeof document !== 'undefined' && document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true })
	} else {
		run()
	}
}

autoInit()

// Public browser API — assigned to window.ThreadText via the IIFE global name.
export { init, destroy }
