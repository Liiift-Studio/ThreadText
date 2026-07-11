// stitchType/src/react/StitchType.tsx — React component wrapper
import React, { forwardRef, useCallback } from 'react'
import { useStitchType } from './useStitchType'
import type { StitchOptions } from '../core/types'

interface StitchTypeProps extends StitchOptions {
	className?: string
	style?: React.CSSProperties
	/** Container element type. (default: 'div') */
	as?: React.ElementType
	/**
	 * Accessible label for the embroidery. Defaults to the embroidered `text`, so
	 * screen readers announce the word even though it is drawn on a canvas.
	 */
	'aria-label'?: string
	role?: string
	'aria-describedby'?: string
}

/**
 * Drop-in component that embroiders `text` inside a self-sizing container. The canvas
 * output is decorative; the word is exposed to assistive tech via `aria-label`.
 */
export const StitchType = forwardRef<HTMLElement, StitchTypeProps>(
	function StitchType({ className, style, as: Tag = 'div', 'aria-label': ariaLabel, role, 'aria-describedby': ariaDescribedby, ...options }, forwardedRef) {
		const innerRef = useStitchType(options)

		// Merge the hook's internal ref with any forwarded ref.
		const mergedRef = useCallback(
			(node: HTMLElement | null) => {
				;(innerRef as React.MutableRefObject<HTMLElement | null>).current = node
				if (typeof forwardedRef === 'function') forwardedRef(node)
				else if (forwardedRef) forwardedRef.current = node
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[innerRef, forwardedRef],
		)

		return (
			<Tag
				ref={mergedRef as React.Ref<HTMLElement>}
				className={className}
				style={style}
				role={role ?? 'img'}
				aria-label={ariaLabel ?? options.text}
				aria-describedby={ariaDescribedby}
			/>
		)
	},
)

StitchType.displayName = 'StitchType'
