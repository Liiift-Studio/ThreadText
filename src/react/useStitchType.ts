// stitchType/src/react/useStitchType.ts — React hook: instance lifecycle + text delta routing
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createStitchText } from '../core/stitchType'
import type { StitchInstance, StitchOptions } from '../core/types'

/**
 * React hook that mounts a stitchType renderer inside a ref'd container.
 *
 * The instance is (re)created only when a *structural* option changes (font, weight,
 * colours, pitch, sizing, motion). Changing just `text` routes through
 * `instance.setText()` so appended letters animate in without a full remount.
 * Re-fits to the container via ResizeObserver and tears down on unmount.
 *
 * @param options - {@link StitchOptions} for the renderer.
 * @returns A ref to attach to the target container element.
 */
export function useStitchType(options: StitchOptions) {
	const ref = useRef<HTMLElement>(null)
	const instanceRef = useRef<StitchInstance | null>(null)
	const optionsRef = useRef(options)
	optionsRef.current = options

	const { text, font, weight, threadColor, fabricColor, pitch, animate, sewRate, sheen, reducedMotion, aspect } = options

	// Structural key — everything *except* text. A change here forces a fresh instance.
	const structuralKey = JSON.stringify({ font, weight, threadColor, fabricColor, pitch, animate, sewRate, sheen, reducedMotion, aspect })

	// (Re)create the instance when structural options change or on mount.
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return

		const instance = createStitchText(el, optionsRef.current)
		instanceRef.current = instance

		let rafId = 0
		let lastWidth = 0
		let ro: ResizeObserver | undefined
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver((entries) => {
				const w = Math.round(entries[0].contentRect.width)
				if (w === lastWidth) return
				lastWidth = w
				cancelAnimationFrame(rafId)
				rafId = requestAnimationFrame(() => instanceRef.current?.resize())
			})
			ro.observe(el)
		}

		return () => {
			ro?.disconnect()
			cancelAnimationFrame(rafId)
			instance.destroy()
			instanceRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [structuralKey])

	// Route text-only changes through setText so the delta animates in place.
	useEffect(() => {
		instanceRef.current?.setText(text)
	}, [text])

	return ref
}
