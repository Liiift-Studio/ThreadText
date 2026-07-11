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
	/** Woven-ground base colour — the outer edge of the fabric. (default near-black linen '#08080a') */
	fabricColor?: string
	/**
	 * Thread spacing in internal pixels. Smaller = finer, denser stitching (and more work).
	 * (default: auto — derived from the canvas height)
	 */
	pitch?: number
	/** Play the sew-in animation when the instance mounts. (default: true) */
	animate?: boolean
	/** Satin cross-rows laid per second during the sew-in. (default: 110) */
	sewRate?: number
	/** Enable the cursor-following radial sheen on the overlay canvas. (default: true) */
	sheen?: boolean
	/**
	 * Force reduced-motion (skip the sew-in, draw instantly). If omitted, the value is
	 * auto-detected from `prefers-reduced-motion`.
	 */
	reducedMotion?: boolean
	/**
	 * Aspect ratio (height / width) of the render surface when the target is a plain
	 * container and its own canvases are created. (default: 0.46)
	 */
	aspect?: number
}

/** Live handle to a mounted threadText renderer. */
export interface ThreadTextInstance {
	/**
	 * Re-embroider with new text. When `text` extends the current word (an append),
	 * only the newly-added letters animate in; otherwise the whole word is re-sewn.
	 */
	setText(text: string): void
	/** Re-run the full sew-in animation for the current word. */
	replay(): void
	/** Re-fit the render surface to its container and rebuild. */
	resize(): void
	/** Cancel the animation loop, remove listeners, and free the created canvases. */
	destroy(): void
	/** The current embroidered text. */
	readonly text: string
}

/** CSS class names applied to the canvases threadText creates inside a container. */
export const THREAD_TEXT_CLASSES = {
	/** Base canvas: woven fabric + baked satin stitches. */
	bg: 'tt-bg',
	/** Overlay canvas: cursor sheen (`mix-blend-mode: screen`). */
	fx: 'tt-fx',
} as const
