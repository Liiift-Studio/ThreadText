// OG image for threadText — tool theme colour, a satin-stitch motif, graceful font fallback
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Thread Text — Photorealistic satin-stitch embroidery for text'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Tool background: oklch(0.240 0.1569 268) */
const BG = '#090268'
/** Foreground — main headline */
const FG = '#f3f5fb'
/** Muted — secondary text, eyebrow, footer chips */
const MUTED = '#b7bece'
/** Subtle — domain */
const SUBTLE = '#9398a5'
/** Floss — the stitch motif */
const FLOSS = '#fdf3df'

export default async function Image() {
	/** Load local Inter 300 — fall back gracefully if the font file is missing */
	let interLight: Buffer | null = null
	try {
		interLight = await readFile(join(process.cwd(), 'public/fonts/inter-300.woff'))
	} catch {
		// Font unavailable — Satori will use its built-in fallback
	}

	const fonts = interLight
		? [{ name: 'Inter', data: interLight, style: 'normal' as const, weight: 300 as const }]
		: []

	return new ImageResponse(
		(
			<div style={{ background: BG, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', fontFamily: 'Inter, sans-serif' }}>
				{/* Eyebrow */}
				<span style={{ fontSize: 13, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>threadtext</span>

				{/* Satin-stitch motif + headline */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
					<div style={{ display: 'flex', gap: 7, marginBottom: 44 }}>
						{Array.from({ length: 34 }).map((_, i) => (
							<div key={i} style={{ width: 6, height: 22, background: FLOSS, borderRadius: 3, transform: `rotate(${i % 2 ? 8 : -8}deg)`, opacity: 0.92 }} />
						))}
					</div>
					<div style={{ fontSize: 82, color: FG, lineHeight: 1.04, fontWeight: 300 }}>Text,</div>
					<div style={{ fontSize: 82, color: MUTED, lineHeight: 1.04, fontWeight: 300, fontStyle: 'italic' }}>embroidered.</div>
				</div>

				{/* Footer */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
					<div style={{ fontSize: 14, color: MUTED, letterSpacing: '0.04em', display: 'flex', gap: 20 }}>
						<span>TypeScript</span><span style={{ opacity: 0.4 }}>·</span>
						<span>Procedural satin stitch</span><span style={{ opacity: 0.4 }}>·</span>
						<span>React + Vanilla JS</span>
					</div>
					<div style={{ fontSize: 13, color: SUBTLE, letterSpacing: '0.04em' }}>threadtext.com</div>
				</div>
			</div>
		),
		{ ...size, fonts },
	)
}
