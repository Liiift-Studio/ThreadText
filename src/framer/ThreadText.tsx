// @ts-nocheck
// threadText/src/framer/ThreadText.tsx — Framer code component wrapping the threadText core.
//
// Distribution: paste this file into Framer (Insert → Code → New Component), or host it as an
// ES module and add it by URL. It imports the framework-agnostic core straight from the CDN, so
// it needs no build step — the core is imperative (createThreadText takes a DOM element, not
// React), so there is no React version/externalisation issue.
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
// Pin to a published version so shared instances stay stable. Bump when the core changes.
import { createThreadText } from "https://esm.sh/@liiift-studio/threadtext@0.2.0"

/** Props surfaced to the Framer UI via addPropertyControls.
 *  Option fields are declared explicitly so the component needs no type import over HTTP. */
interface ThreadTextFramerProps {
	/** The word (or short phrase) to embroider. */
	text: string
	/** CSS font-family of a loaded font used to rasterise the glyphs. */
	fontFamily: string
	/** Numeric font weight (100–900). */
	weight: number
	/** Floss (thread) colour — the lit crest of each thread. */
	threadColor: string
	/** Fraction of the width the word spans (its size). */
	fill: number
	/** Sew-in style: 'machine' satin rows, or 'hand' single-thread. */
	sewStyle: "machine" | "hand"
	/** Satin cross-rows laid per second during the sew-in. */
	sewRate: number
	/** Cursor-following sheen on the overlay canvas. */
	sheen: boolean
	/** Play the sew-in animation on mount. */
	animate: boolean
}

/**
 * Procedural satin-stitch embroidery, as a Framer code component.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ThreadText(props: Partial<ThreadTextFramerProps>) {
	const {
		text = "Thread",
		fontFamily = "Georgia, serif",
		weight = 680,
		threadColor = "#fffbf3",
		fill = 0.9,
		sewStyle = "machine",
		sewRate = 110,
		sheen = true,
		animate = true,
	} = props

	const ref = useRef<HTMLDivElement>(null)
	const instRef = useRef(null)

	// Animate on the live site and on the editing canvas (so the designer sees the sew-in);
	// draw a single static frame on export / thumbnails where a loop is undesirable.
	const live = RenderTarget.current() === RenderTarget.preview || RenderTarget.current() === RenderTarget.canvas

	// Create once; option changes are applied live (no re-sew).
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const instance = createThreadText(el, { text, font: fontFamily, weight, threadColor, fill, sewStyle, sewRate, sheen: live ? sheen : false, animate: live ? animate : false })
		instRef.current = instance
		return () => instance.destroy()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [live])

	useEffect(() => { instRef.current?.update({ font: fontFamily, weight, threadColor, fill, sewStyle, sewRate, sheen: live ? sheen : false, animate: live ? animate : false }) }, [fontFamily, weight, threadColor, fill, sewStyle, sewRate, sheen, animate, live])
	useEffect(() => { instRef.current?.setText(text) }, [text])

	return <div ref={ref} style={{ width: "100%" }} role="img" aria-label={text} />
}

// Map every meaningful ThreadTextOptions field to a Framer control.
addPropertyControls(ThreadText, {
	text: { type: ControlType.String, title: "Text", defaultValue: "Thread", displayTextArea: false },
	fontFamily: { type: ControlType.String, title: "Font", defaultValue: "Georgia, serif", description: "A loaded font family. The glyph geometry drives the stitch flow." },
	weight: { type: ControlType.Number, title: "Weight", defaultValue: 680, min: 100, max: 900, step: 10 },
	threadColor: { type: ControlType.Color, title: "Thread", defaultValue: "#fffbf3" },
	fill: { type: ControlType.Number, title: "Size", defaultValue: 0.9, min: 0.3, max: 1, step: 0.02, description: "Fraction of the width the word fills." },
	sewStyle: { type: ControlType.Enum, title: "Sew style", options: ["machine", "hand"], optionTitles: ["Machine", "Hand"], defaultValue: "machine" },
	sewRate: { type: ControlType.Number, title: "Sew rate", defaultValue: 110, min: 20, max: 400, step: 10, description: "Rows/stitches per second." },
	sheen: { type: ControlType.Boolean, title: "Sheen", defaultValue: true },
	animate: { type: ControlType.Boolean, title: "Sew-in", defaultValue: true },
})
