import { defineConfig } from 'vite';

// base: "/" for the custom domain (https://dealwithit.gonzhome.us)
//        "/dealwithit/" for the GitHub Pages repository subpath preview.
// Set VITE_BASE at build time, e.g. VITE_BASE=/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? '/dealwithit/',
  build: { outDir: 'dist' }
});
