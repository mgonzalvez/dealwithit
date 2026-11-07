import { defineConfig } from 'vite';

// base: "./" makes every asset URL relative to the page, so the same build
// works at the repo Pages subpath (https://mgonzalvez.github.io/dealwithit/)
// and at a custom-domain root (https://dealwithit.gonzhome.us).
// Override only if you need an absolute base: VITE_BASE=/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  build: { outDir: 'dist' }
});
