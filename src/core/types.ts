// threadText/src/core/types.ts — options, instance interface, and class constants

/**
 * Options controlling the procedural satin-stitch embroidery renderer.
 * Colours accept any CSS-ish hex (`#rgb` / `#rrggbb`) or `rgb()/rgba()` string.
 */
export interface ThreadTextOptions {
	/** The word (or short phrase) to embroider. */
	text: string
	/**
	 * CSS `font-family` of an already-loaded font used to rasterise the glyphs.
	 * The renderer is font-agnostic — load the face however you like (`@font-face`,
	 * `next/font`, the CSS Font Loading API) before calling. (default: 'Georgia, serif')
	 */
	font?: string
	/** Numeric font weight passed to the canvas `font` shorthand (100–900). (default: 680) */
	weight?: number
	/** Floss (thread) colour — the lit crest of each thread. (default: warm white '#fffbf3') */
	threadColor?: string
	/**
	 * Thread spacing in internal pixels. Smaller = finer, denser stitching (and more work).
	 * (default: auto — derived from the fitted text height)
	 */
	pitch?: number
	/**
	 * Fraction of the container width the word spans — the effective text size. The word is
	 * re-fitted to `fill × containerWidth` on load and resize, leaving the remainder as
	 * horizontal padding. Range ~0.3–1. (default: 0.9)
	 */
	fill?: number
	/** Play the sew-in animation on mount and on `replay()`. (default: true) */
	animate?: boolean
	/**
	 * How the word is sewn in:
	 * - **'machine'** (default) — satin cross-rows appear in parallel across each stroke, like
	 *   machine embroidery (a BFS over the stitch graph).
	 * - **'hand'** — a single continuous thread wanders stitch by stitch along each stroke and
	 *   carries to the next, laying one stitch at a time, like hand embroidery.
	 */
	sewStyle?: 'machine' | 'hand'
	/** Satin cross-rows (machine) or stitches (hand) laid per second during the sew-in. (default: 110) */
	sewRate?: number
	/** Enable the cursor-following radial sheen on the overlay canvas. (default: true) */
	sheen?: boolean
	/**
	 * Make the surface focusable and typeable — click (or Tab) to focus, then type to edit
	 * the word, Backspace to delete, Enter to replay the sew-in. Shows a blinking caret.
	 * (default: false)
	 */
	editable?: boolean
	/** Called with the new text whenever the user edits it directly (editable mode only). */
	onTextChange?: (text: string) => void
	/**
	 * Force reduced-motion (skip the sew-in, draw instantly). If omitted, the value is
	 * auto-detected from `prefers-reduced-motion`.
	 */
	reducedMotion?: boolean
}

/** Live handle to a mounted threadText renderer. */
export interface ThreadTextInstance {
	/** Re-embroider with new text — re-fits to width and redraws instantly (no sew-in). */
	setText(text: string): void
	/** Re-run the sew-in animation for the current word (when `animate` is on). */
	replay(): void
	/** Re-fit the render surface to its container and redraw. */
	resize(): void
	/**
	 * Apply option changes live and redraw instantly — never re-runs the sew-in. Use for
	 * colour, font, weight, size (`fill`), sew rate, sheen, and editability changes.
	 */
	update(options: Partial<ThreadTextOptions>): void
	/** Focus the surface for typing (editable mode). */
	focus(): void
	/** Cancel the animation loop, remove listeners, and free the created canvases. */
	destroy(): void
	/** The current embroidered text. */
	readonly text: string
}

/** CSS class names applied to the canvases threadText creates inside a container. */
export const THREAD_TEXT_CLASSES = {
	/** Base canvas: the baked satin stitches (transparent ground). */
	bg: 'tt-bg',
	/** Overlay canvas: cursor sheen (`mix-blend-mode: screen`). */
	fx: 'tt-fx',
	/** Blinking text caret shown in editable mode. */
	caret: 'tt-caret',
} as const
