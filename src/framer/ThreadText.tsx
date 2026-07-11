// @ts-nocheck
// threadText/src/framer/ThreadText.tsx — Framer code component wrapping the threadText core.
//
// Distribution: paste this file into Framer (Insert → Code → New Component), or host it as an
// ES module and add it by URL. It imports the framework-agnostic core straight from the CDN, so
// it needs no build step — the core is imperative (createThreadText takes a DOM element, not
// React), so there is no React version/externalisation issue.
//
// NOTE: the esm.sh import below pins a published npm version. threadText must be published to npm
// at that version first (see HANDOFF ship step) — until then, use it against a locally hosted build.
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
// Pin to a published version so shared instances stay stable. Bump when the core changes.
import { createThreadText } from "https://esm.sh/@liiift-studio/threadtext@0.0.1"

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
	/** Woven-ground base colour. */
	fabricColor: string
	/** Satin cross-rows laid per second during the sew-in. */
	sewRate: number
	/** Cursor-following sheen on the overlay canvas. */
	sheen: boolean
	/** Play the sew-in animation on mount. */
	animate: boolean
	/** Aspect ratio (height / width) of the render surface. */
	aspect: number
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
		fabricColor = "#08080a",
		sewRate = 110,
		sheen = true,
		animate = true,
		aspect = 0.46,
	} = props

	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const el = ref.current
		if (!el) return

		// Animate on the live site and on the editing canvas (so the designer sees the sew-in);
		// draw a single static frame on export / thumbnails where a loop is undesirable.
		const target = RenderTarget.current()
		const live = target === RenderTarget.preview || target === RenderTarget.canvas

		const instance = createThreadText(el, {
			text,
			font: fontFamily,
			weight,
			threadColor,
			fabricColor,
			sewRate,
			sheen: live ? sheen : false,
			animate: live ? animate : false,
			aspect,
		})
		return () => instance.destroy()
	}, [text, fontFamily, weight, threadColor, fabricColor, sewRate, sheen, animate, aspect])

	return <div ref={ref} style={{ width: "100%" }} role="img" aria-label={text} />
}

// Map every meaningful ThreadTextOptions field to a Framer control.
addPropertyControls(ThreadText, {
	text: {
		type: ControlType.String,
		title: "Text",
		defaultValue: "Thread",
		displayTextArea: false,
	},
	fontFamily: {
		type: ControlType.String,
		title: "Font",
		defaultValue: "Georgia, serif",
		description: "A loaded font family. The glyph geometry drives the stitch flow.",
	},
	weight: { type: ControlType.Number, title: "Weight", defaultValue: 680, min: 100, max: 900, step: 10 },
	threadColor: { type: ControlType.Color, title: "Thread", defaultValue: "#fffbf3" },
	fabricColor: { type: ControlType.Color, title: "Fabric", defaultValue: "#08080a" },
	sewRate: { type: ControlType.Number, title: "Sew rate", defaultValue: 110, min: 20, max: 400, step: 10, description: "Satin rows per second." },
	aspect: { type: ControlType.Number, title: "Aspect", defaultValue: 0.46, min: 0.2, max: 1, step: 0.02, description: "Height ÷ width." },
	sheen: { type: ControlType.Boolean, title: "Sheen", defaultValue: true },
	animate: { type: ControlType.Boolean, title: "Sew-in", defaultValue: true },
})
