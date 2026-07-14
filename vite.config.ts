// vite.config.ts — library-mode build for ESM + CJS + types
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
	plugins: [
		react(),
		dts({ include: ['src'], exclude: ['src/__tests__/**'], rollupTypes: true }),
	],
	// NOTE: do NOT enable esbuild keepNames — it injects a `__name(fn, "…")` helper reference into
	// function bodies, which breaks the runtime Worker assembled from Function.toString() (the helper
	// isn't defined in the worker scope). esbuild's default naming already emits self-contained,
	// mutually-consistent `function X(){}` declarations, which is what the worker assembly needs.
	build: {
		lib: {
			entry: 'src/index.ts',
			formats: ['es', 'cjs'],
			fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
		},
		rollupOptions: {
			external: ['react', 'react-dom', 'react/jsx-runtime'],
			// No globals needed — this build only produces es and cjs formats, not iife/umd.
		},
	},
})
