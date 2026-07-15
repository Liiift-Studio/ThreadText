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
	/**
	 * Variable-font axis values applied to the rasterised glyphs, e.g. `{ opsz: 40, SOFT: 60 }`.
	 * Uses the canvas `fontVariationSettings` API (Chrome/Edge/Safari) so the browser's own
	 * variable rendering drives the stitch shapes; silently ignored where unsupported (the font's
	 * default instance is used). Note: numeric `weight` already drives the `wght` axis via the
	 * standard font shorthand — reach for `axes` for `opsz` and custom axes (`SOFT`, `WONK`, …).
	 */
	axes?: Record<string, number>
	/** Floss (thread) colour — the lit crest of each thread. (default: warm white '#fffbf3') */
	threadColor?: string
	/**
	 * Second floss colour, used by `colorMode: 'twotone'` and `'gradient'`. Ignored when
	 * `colorMode` is `'solid'` (the default). (default: falls back to `threadColor`)
	 */
	threadColor2?: string
	/**
	 * How the floss is coloured:
	 * - **'solid'** (default) — one colour (`threadColor`).
	 * - **'twotone'** — two colours (`threadColor` + `threadColor2`) laid as alternating threads
	 *   packed side by side across each stroke.
	 * - **'gradient'** — a smooth colour transition from `threadColor` to `threadColor2` across the word.
	 */
	colorMode?: 'solid' | 'twotone' | 'gradient'
	/**
	 * Add a darker running-stitch **backstitch outline** traced around each glyph — the way a piece is
	 * often finished by hand. Sews in last. (default: false)
	 */
	backstitch?: boolean
	/** Backstitch outline colour. (default: a darkened shade of `threadColor`) */
	outlineColor?: string
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
	/**
	 * Horizontal alignment of the word within the canvas when `fill` leaves spare width.
	 * `'center'` (default) · `'left'` · `'right'`.
	 */
	align?: 'left' | 'center' | 'right'
	/** Play the sew-in animation on mount and on `replay()`. (default: true) */
	animate?: boolean
	/**
	 * How the word is sewn in:
	 * - **'machine'** (default) — satin cross-rows appear in parallel across each stroke, like
	 *   machine embroidery (a BFS over the stitch graph).
	 * - **'hand'** — works one letter at a time (left to right). Within each letter it enters at
	 *   the widest region near the top and works its way down the strokes, then cleans up the thin
	 *   serifs and terminals last — the way a person embroiders a shape.
	 */
	sewStyle?: 'machine' | 'hand'
	/**
	 * The stitch texture filling each stroke:
	 * - **'satin'** (default) — smooth parallel threads across the stroke (raised satin floss).
	 * - **'cross'** — little X's, like cross-stitch.
	 * - **'chain'** — a field of looped links.
	 * - **'running'** — short dashes, a sparser hand-run look.
	 */
	stitchMode?: 'satin' | 'cross' | 'chain' | 'running'
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
