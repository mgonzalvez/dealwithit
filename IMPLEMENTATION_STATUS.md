# Implementation Status

Last updated: 2026-11-01

| Milestone | Status | Notes |
|---|---|---|
| M0 — Scaffold & design system | ✅ Done | Vite + React + TS strict app, hash routing, responsive shell, theme (light/dark via CSS variables, 44px touch targets), Button/Dialog/Menu/EmptyState primitives, Dexie IndexedDB schema (version 1), Zod domain schemas, pure deck/table operations with unit tests, demo project (procedurally generated original artwork), GitHub Actions Pages deploy, README |
| M1 — Upload Images + Import ZIP | ✅ Done | Shared staging pipeline: single/multi upload, drag/drop anywhere, clipboard paste, ZIP import (flat, nested, corrupt, fronts/backs pairing detection), SHA-256 duplicate detection (in-batch and against library), per-file errors, progress, cancel, canvas thumbnails, searchable natural-sorted asset grid, preview dialog, post-import destination choice (Keep in Library / Create Draft Deck / Add to Existing Deck) |
| M2 — Card definitions & Workshop | ⬳ Not started | Deck recipe operations exist and are tested; editor UI pending |
| M3 — Table MVP | ⬳ Not started | Pure table operations exist and are tested; interactive canvas pending |
| M4 — Export/import (.dealwithit.zip) | ⬳ Not started | Manifest builder scaffolded; ZIP round-trip pending |
| M5 — PWA & polish | ⬳ Partial stub | Manifest + SVG icons present; service worker, PNG icons, offline shell pending |
| M6 — Card Extractor bridge | ⬳ Deferred | Intentionally blocked until the real Card Extractor export contract is inspected |

## Verified gates

**M0:** lint, typecheck, tests, build (both bases) — passing.
**M1:** lint, typecheck, 41 unit/integration tests, build — passing.

### M1 automated coverage (`src/test/import-pipeline.test.ts`)
- Path-safety and OS-metadata rules
- Natural sort ("card 2" before "card 10")
- SHA-256 duplicate detection: in-batch, different filenames/identical bytes, and against existing library
- Corrupt ZIP → clear error, no crash
- Flat and nested ZIPs; unsupported files reported per-file (batch continues)
- fronts/backs: shared-back detection, stem pairing, uncertain-pairing flag
- Zip-slip guard (raw-ZIP fixture; JSZip normalizes paths on read, guard is a second layer)
- Integration: 1 upload + 100 mixed files + Card Extractor-style ZIP + 5 more (incl. 1 byte-identical duplicate) → 108 unique assets committed
- Cancel mid-commit stops cleanly

### M1 manual acceptance checklist (browser)
1. Open a project in Workshop. Confirm **Upload Images** and **Import ZIP** are both visible and equal prominence (desktop + iPad).
2. Upload one PNG → staging shows it with thumbnail and dimensions → Import → it appears in the asset grid after reload.
3. Select 100 mixed PNG/JPEG/WebP files in one picker action → progress shown, no freeze; bad file shows an error but the batch continues.
4. Drag images anywhere onto the Workshop page; paste an image from the clipboard.
5. Import a corrupt ZIP → error message, no crash.
6. Import a ZIP with `fronts/` + single `backs/` image → shared-back note appears.
7. Repeat imports in any order; duplicates flagged, not lost, not duplicated as blobs.
8. After import choose Keep in Library / Create draft deck / Add to existing deck; cancel leaves no orphaned decks.
9. Reload the browser — all assets, thumbnails, and deck counts intact.

## Known gaps / next steps

1. Playwright E2E and React Testing Library tests not yet added (M3+).
2. PNG PWA icons (currently SVG placeholders).
3. Service worker / offline shell (M5).
4. Card editor (rotation, crop, mm sizes, front/back assignment beyond auto-creation) — M2.
