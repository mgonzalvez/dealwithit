# Implementation Status

Last updated: 2026-11-01

| Milestone | Status | Notes |
|---|---|---|
| M0 — Scaffold & design system | ✅ Done | Vite + React + TS strict app, hash routing, responsive shell, theme (light/dark via CSS variables, 44px touch targets), Button/Dialog/Menu/EmptyState primitives, Dexie IndexedDB schema (version 1), Zod domain schemas, pure deck/table operations with unit tests, demo project (procedurally generated original artwork), GitHub Actions Pages deploy, README |
| M1 — Upload Images + Import ZIP | ⬳ Not started | Workshop page has the two equal-prominence entry points wired to file pickers; staging pipeline, hashing/dedupe, thumbnails, ZIP parsing (incl. fronts/backs pairing review) pending |
| M2 — Card definitions & Workshop | ⬳ Not started | Deck recipe operations exist and are tested; editor UI pending |
| M3 — Table MVP | ⬳ Not started | Pure table operations exist and are tested; interactive canvas pending |
| M4 — Export/import (.dealwithit.zip) | ⬳ Not started | Manifest builder scaffolded; ZIP round-trip pending |
| M5 — PWA & polish | ⬳ Partial stub | Manifest + SVG icons present; service worker, PNG icons, offline shell pending |
| M6 — Card Extractor bridge | ⬳ Deferred | Intentionally blocked until the real Card Extractor export contract is inspected |

## Verified gates (M0)

- `npm run lint` — passing
- `npm run typecheck` — passing
- `npm test` — passing (deck ops, table ops, transforms, schemas)
- `npm run build` — passing (base `/dealwithit/`; `VITE_BASE=/` for custom-domain builds)

## Known gaps / next steps

1. Playwright E2E and React Testing Library tests not yet added (M1+).
2. PNG PWA icons (currently SVG placeholders).
3. Service worker / offline shell (M5).
4. Import fixtures (single PNG, 100-image batch, flat/nested ZIPs, corrupt ZIP) — to be generated as part of M1 tests.
