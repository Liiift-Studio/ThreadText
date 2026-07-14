// scripts/capture/react-stub.js — satisfies the ESM bundle's externalised `react` /
// `react/jsx-runtime` imports so it can load in a bare browser module context. The capture
// only exercises createThreadText (pure core, no React at runtime), so these are inert.
export const useRef = () => ({ current: null })
export const useLayoutEffect = () => {}
export const useEffect = () => {}
export const useCallback = (f) => f
export const forwardRef = (f) => f
export const jsx = () => null
export const jsxs = () => null
export const Fragment = Symbol("Fragment")
export default {}
