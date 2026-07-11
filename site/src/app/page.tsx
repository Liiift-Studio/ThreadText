// threadText landing page — procedural satin-stitch embroidery tool site
import Demo from "@/components/Demo"
import CopyInstall from "@/components/CopyInstall"
import CodeBlock from "@/components/CodeBlock"
import { version } from "../../../package.json"
import { version as siteVersion } from "../../package.json"
import SiteFooter from "../components/SiteFooter"
import PortsSection from "../components/PortsSection"

/** JSON-LD structured data for rich search results */
const jsonLd = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: 'Thread Text',
	url: 'https://threadtext.com',
	applicationCategory: 'DeveloperApplication',
	operatingSystem: 'Any',
	description: 'Render any word as photorealistic satin-stitch embroidery, in real time in the browser, from the font’s own glyph geometry. Procedural, not AI. React + vanilla JS.',
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	programmingLanguage: 'TypeScript',
}

export default function Home() {
	return (
		<>
		<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-[0.18em] font-medium text-muted">threadtext</p>
					<h1 className="text-5xl lg:text-8xl xl:text-9xl" style={{ fontFamily: '"Fraunces", Georgia, serif', fontVariationSettings: '"wght" 600, "opsz" 144', lineHeight: "1.02em" }}>
						Text,<br />
						<span style={{ color: "var(--foreground-subtle)", fontStyle: "italic", fontVariationSettings: '"wght" 500, "opsz" 144' }}>embroidered.</span>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a
						href="https://github.com/Liiift-Studio/ThreadText"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="ThreadText on GitHub (opens in new tab)"
						className="text-sm text-muted hover:text-foreground transition-colors"
					>
						GitHub ↗
					</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tracking-wide">
					<span>TypeScript</span><span aria-hidden="true">·</span><span>Zero dependencies</span><span aria-hidden="true">·</span><span>React + Vanilla JS</span>
				</div>
				<p className="text-base leading-relaxed max-w-lg">
					Give it a word in any loaded font and it renders as raised satin floss on woven fabric — threads that run <em>across</em> each stroke and fan around the curves, lifted into 3D, seated with a contact shadow, and sewn in one satin stitch at a time. Photorealistic <em>by construction</em>, from the font&rsquo;s real glyph geometry — not a raster filter, not an AI image.
				</p>
			</section>

			{/* Demo */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Live demo — type a word</h2>
				<div className="rounded-xl -mx-8 px-8 py-8" style={{ background: "var(--panel)", overflow: 'hidden' }}>
					<Demo />
				</div>
			</section>

			{/* Explanation */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">How it works</h2>
				<div className="prose-grid grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed">
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Glyphs drive the flow</p>
						<p>The word is rasterised, then an exact distance transform gives a flow field — smoothed in double-angle orientation space so opposite edge-normals reinforce. Threads run <em>across</em> each stroke and fan cleanly around the curves, with no moir&eacute;.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Thread, lit and seated</p>
						<p>Thousands of pre-shaded thread sprites are laid along the flow, lifted into 3D by a dome-shade normal map, and seated on procedural woven fabric with a contact shadow. A cursor-following sheen turns the threads over in the light.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Sewn in, one row at a time</p>
						<p>A breadth-first pass over the stitch graph reveals the word one satin cross-row at a time — the needle following each stroke, letters filling left to right. Typing re-embroiders and animates only the newly-added letters.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Accessibility &amp; motion</p>
						<p>The canvas is decorative; the word is exposed to assistive tech via <span className="font-mono text-xs">role=&quot;img&quot;</span> and an <span className="font-mono text-xs">aria-label</span>. <span className="font-mono text-xs">prefers-reduced-motion: reduce</span> is honoured — the sew-in is skipped and the word is drawn instantly.</p>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex items-baseline gap-4">
					<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Usage</h2>
				</div>
				<div className="flex flex-col gap-8 text-sm">
					<div className="flex flex-col gap-3">
						<p className="text-muted">Drop-in component</p>
						<CodeBlock code={`import { ThreadText } from '@liiift-studio/threadtext'

<ThreadText text="Thread" font='"Your Font", serif' weight={680} />`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Hook</p>
						<CodeBlock code={`import { useThreadText } from '@liiift-studio/threadtext'

const ref = useThreadText({ text: 'Thread', font: '"Your Font", serif', weight: 680 })
<div ref={ref} />`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Vanilla JS</p>
						<CodeBlock code={`import { createThreadText } from '@liiift-studio/threadtext'

// Load the face first (any @font-face / next/font / CSS Font Loading API), then:
const thread = createThreadText(document.getElementById('host'), {
  text: 'Thread', font: '"Your Font", serif', weight: 680,
})

thread.setText('Threads') // appended letters sew in; unrelated text re-sews
thread.replay()           // re-run the full sew-in
thread.destroy()          // cancel rAF, remove listeners, free canvases`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Options</p>
						<table className="w-full text-xs">
							<caption className="sr-only">ThreadText options reference</caption>
							<thead>
								<tr className="text-subtle text-left">
									<th scope="col" className="pb-2 pr-6 font-normal">Option</th>
									<th scope="col" className="pb-2 pr-6 font-normal">Default</th>
									<th scope="col" className="pb-2 font-normal">Description</th>
								</tr>
							</thead>
							<tbody className="text-muted">
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">text</td><td className="py-2 pr-6">—</td><td className="py-2">The word (or short phrase) to embroider. Required.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">font</td><td className="py-2 pr-6">&apos;Georgia, serif&apos;</td><td className="py-2">CSS font-family of an already-loaded font. The glyph geometry drives the stitch flow — load it however you like before calling.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">weight</td><td className="py-2 pr-6">680</td><td className="py-2">Numeric font weight (100–900).</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">threadColor</td><td className="py-2 pr-6">&apos;#fffbf3&apos;</td><td className="py-2">Floss colour — the lit crest of each thread. Hex or rgb().</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">fabricColor</td><td className="py-2 pr-6">&apos;#08080a&apos;</td><td className="py-2">Woven-ground base colour — the outer edge of the fabric.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">pitch</td><td className="py-2 pr-6">auto</td><td className="py-2">Thread spacing in px. Smaller = finer, denser stitching (and more work). Derived from height if unset.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">sewRate</td><td className="py-2 pr-6">110</td><td className="py-2">Satin cross-rows laid per second during the sew-in.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">sheen</td><td className="py-2 pr-6">true</td><td className="py-2">Cursor-following radial sheen on the overlay canvas.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">animate</td><td className="py-2 pr-6">true</td><td className="py-2">Play the sew-in animation on mount. When false (or reduced-motion), the word is drawn instantly.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">reducedMotion</td><td className="py-2 pr-6">auto</td><td className="py-2">Force reduced-motion. Auto-detected from prefers-reduced-motion if omitted.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">aspect</td><td className="py-2 pr-6">0.46</td><td className="py-2">Height ÷ width of the render surface when a container creates its own canvases.</td></tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<PortsSection
				npm="@liiift-studio/threadtext"
				bundle="threadtext"
				attr="data-threadtext"
				framerComponent="ThreadText"
				repo="Liiift-Studio/ThreadText"
			/>

			<SiteFooter current="threadText" npmVersion={version} siteVersion={siteVersion} />

		</main>
		</>
	)
}
