# Deal With It — Agent Guidelines

## Project Overview

**Deal With It** is a free, browser-based, local-first card-game sandbox ("The Print-and-Play Card Sandbox"). Users upload individual card images or import ZIPs (including Card Extractor exports), assemble decks in the Workshop, then play on a virtual Table (shuffle, draw, flip, drag, stack). No rules engine, no backend, no accounts.

- **Canonical product name:** Deal With It (wordmark may render as `dealwithit.`; never show the old working title "CardTable Workshop" in the shipped UI)
- **Descriptor:** The Print-and-Play Card Sandbox
- **Tagline:** Make your decks. Play your cards.
- **Target URL:** `https://dealwithit.gonzhome.us` (GitHub Pages, custom domain — verify DNS before claiming it resolves)
- **Suggested repo:** `dealwithit`
- **Canonical spec:** `Deal_With_It_Final_Codex_Build_Spec.md` (Version 3.0 FINAL, 2026-11-01) — read it fully before implementing

## Tech Stack

- **Frontend:** Vite + React + TypeScript (strict), CSS variables, lightweight handcrafted components (no heavyweight UI libraries)
- **State:** Zustand (or React context if sufficient)
- **Persistence:** Dexie + IndexedDB for metadata and image blobs — **never** store images in localStorage or as base64 in JSON. Schema versioning lives in `src/persistence/db.ts` (currently version 2); new indexes require a `version(n).stores({...})` block, not editing version 1
- **Deck icons:** curated Fractal Symbols SVGs (Felix Thalin, CC BY 4.0 — same set as TokenMaker) in `public/deck-icons/`, registered in `src/features/decks/deckIcons.tsx`; rendered inline via `fetch` + `dangerouslySetInnerHTML` so `currentColor` inherits the theme
- **Table rendering:** HTML/CSS transformed cards in a single pan/zoom layer with pointer events; only move to PixiJS/canvas if benchmarks require it
- **ZIP handling:** JSZip or fflate
- **Validation:** Zod (or equivalent) for schema/runtime validation
- **IDs:** `crypto.randomUUID()`
- **Testing:** Vitest (pure logic), React Testing Library (components), Playwright (E2E, WebKit where possible)
- **Tooling:** ESLint + Prettier, GitHub Actions (lint, typecheck, test, build, deploy dist to GitHub Pages)

## Architecture

### Core flow
Home/Library → Create Game → **Upload Images** or **Import ZIP** (equal prominence) → Workshop (Cards & Decks) → Table → Save/Resume → Export `.dealwithit.zip`

### Data model (see spec §4)
Separate layers, never conflated:
- `ImageAsset` — immutable original blobs (sha256-hashed for dedupe)
- `CardDefinition` — front/back asset refs + non-destructive transforms + mm dimensions
- `DeckDefinition` — a **recipe** (entries with quantities), not a mutable live pile
- `CardInstance` / `TableObject` — live instances on the table; table ops never mutate deck recipes
- `Project` — top-level container with schema version

Key rules:
- Shuffling uses Fisher–Yates with `crypto.getRandomValues`; only instance order changes, never the recipe
- `cardInstances[0]` = bottom, last = top (keep consistent everywhere)
- Table operations are pure functions returning new state, with unit tests
- Undo/redo: bounded snapshot/command history (~50), no image blob duplication

### Deployment modes
- Vite `base` configurable: `/` for `dealwithit.gonzhome.us`, `/dealwithit/` for repo Pages preview
- `public/CNAME` containing `dealwithit.gonzhome.us` for custom-domain deployment
- Prefer hash routing or in-app navigation to avoid Pages deep-link 404s (`#/workshop/<id>/import|cards|decks` encodes the Workshop tab)
- Resolve static asset URLs with `import.meta.env.BASE_URL`, not a hand-rolled env var
- PWA: manifest, 192/512 icons, favicon, service worker precaching app shell only (never user images)
- Both root-domain and subpath builds must pass smoke tests

### Export/import contract
- Export: `.dealwithit.zip`, manifest `format: "dealwithit-project"`, `version: 1`, project JSON + original image blobs in `assets/<id>.<ext>` + checksums
- Import: validate manifest, IDs, references, archive size, supported version; reject ZIP-slip/malicious paths; remap IDs on collision
- Ordinary image ZIPs (flat, nested, or Card Extractor-style `fronts/`/`backs/`) import without a manifest
- Ignore `__MACOSX`, `.DS_Store`; detect duplicates by hash; report duplicates rather than silently discarding
- Legacy `.cardtable.zip` aliases only if an earlier prototype actually used them — no speculative compatibility

## Card Extractor Integration

Card Extractor lives at `https://extractor.gonzhome.us` (tools index: `https://gonzhome.us`).

- **MVP:** generic image/ZIP import only. First-class adapter for `fronts/`/`backs/` ZIP layouts with a pairing-review screen for ambiguous cases. Never invent Card Extractor's API.
- **Phase 2 (M6):** only after inspecting real Card Extractor source/export. Options: direct `.dealwithit.zip` export bundle, `postMessage` with origin/schema/size checks, or share/import flow. No query-string payloads, no cross-origin storage assumptions.

## Milestones (implement in order, verify gates before advancing)

| Milestone | Scope | Gate |
|---|---|---|
| M0 | Scaffold, design system, routing, IndexedDB, README, deploy workflow, demo project | lint + typecheck + tests + build pass; deployed base path works |
| M1 | Upload Images **and** Import ZIP (both mandatory, equally prominent), staging UI, dedupe, thumbnails, mixed imports | 1 PNG + 100 mixed files + ZIP + 5 more loose images all persist correctly after reload |
| M2 | Card definitions, transforms/crops/rotation, fronts/backs, mm sizes, deck recipes, quantities, autosave | 3 decks / 60+ cards survive reload |
| M3 | Table MVP: stacks, pan/zoom, draw, flip, drag, rotate, shuffle, gather, save/resume | Full manual solo sequence; reload resumes exactly |
| M4 | Export/import round-trip, migrations, undo/redo, storage warnings, accessibility | Desktop export → iPad import matches; undo shuffle/draw/move |
| M5 | PWA, offline shell, iPad Safari ergonomics, performance, tutorial + demo game | Play on iPad touch-only, offline after install |
| M6 | Optional direct Card Extractor bridge (only after real contract inspection) | Extract → import with zero per-card manual steps |

## Conventions

- **Naming consistency:** "Deal With It" in browser title, manifest, README, nav, About, export filenames
- **Plain-language primary actions:** `Upload Images`, `Import ZIP`, `Workshop`, `Play on Table`, `Shuffle`, `Draw`, `Flip`, `Save`, `Export` — no joke labels on critical controls, errors, or destructive actions
- **Tribute:** CardWarden attribution appears in **About only**, never as co-branding; no CardWarden assets/branding
- **Brand assets:** original SVG logo (fan of cards / deal motif), light/dark variants, no copied CardWarden art
- **Accessibility:** 44px minimum touch targets, keyboard alternatives, visible focus states, sufficient contrast, touch-first on iPad
- **Performance budgets:** 500 images / 10 decks / 300 instances; ~60 fps with 100 visible objects; no layout reads inside `pointermove`; rAF batching; batched image decoding; lazy-load + thumbnails; never decode all full-res assets at once
- **Error handling:** per-file failures don't abort batches; graceful handling of corrupted files, empty decks, missing images, quota errors, interrupted imports
- **Transactional persistence:** canceled imports leave no orphaned definitions/entries
- **Table defaults:** launched deck = one stack, backs visible, count badge; neutral generated back if no custom back; table 1600×1000 logical units

## Non-goals (do NOT build)

Game rules, scoring, AI, multiplayer, accounts, cloud sync, analytics, ads, DRM, bundled copyrighted art, backend services. PDF import, boards, dice, tokens, multiple tables, and multiplayer are explicitly future modules, not MVP.

## Agent Execution Discipline

- Inspect the repo first; preserve existing code if present
- Implement milestone vertical slices in order; commit after each verified milestone if git is configured
- Run the actual test commands before claiming a milestone complete; report outcomes
- Keep `IMPLEMENTATION_STATUS.md` current (milestone status, verified tests, known gaps, next steps)
- Do not stop at planning or scaffolding — M1 is incomplete if only one import mode works
- If external sources (Card Extractor repo) are inaccessible, state that and use documented adapters/fixtures

## Commands

```bash
npm run lint        # ESLint
npm run typecheck   # strict TS check
npm test            # Vitest (74 tests as of 2026-11-02)
npm run build       # Vite production build (default base /dealwithit/)
VITE_BASE=/ npm run build  # root-domain build for dealwithit.gonzhome.us
npm run icons       # regenerate PNG app icons (192/512)
npm run preview     # preview the built app
```

## Repository Layout (suggested)

```
src/
  app/ components/ domain/ persistence/ integration/ features/ styles/ test/
public/
  deck-icons/      # Fractal Symbols SVGs (CC BY 4.0) for deck icons
  favicon.svg, manifest.webmanifest, sw.js, icons/
.github/workflows/deploy.yml
```
