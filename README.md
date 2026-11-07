# Deal With It

**The Print-and-Play Card Sandbox** — *Make your decks. Play your cards.*

Deal With It is a free, browser-based, local-first card-game sandbox for
Print-and-Play gamers. Upload card images (one at a time, in bulk, drag/drop
or paste) or import a ZIP (including Card Extractor exports), assemble decks
in the Workshop, then play on a virtual Table: shuffle, draw, flip, drag and
stack. No rules engine, no accounts, no backend — your files stay on your
device unless you export them.

A guided step-by-step tour walks new players through the full workflow
(Library → Import → Cards → Decks → Table → Export), navigating to each
section live as it explains what to do there.

Intended public address: **https://dealwithit.gonzhome.us** (GitHub Pages with
a custom domain; DNS setup is documented below and not yet verified).

> **A nod to CardWarden** — Deal With It was inspired by CardWarden, Michael
> Azzara's pioneering iPad card-game sandbox. It carries forward the idea that
> playing your own card games digitally should be simple, flexible, and fun.
> An independent project from GonzHome. (Attribution of inspiration only; no
> affiliation, endorsement, or shared assets.)

## Play straight away — the built-in standard deck

You do not need to upload anything to play. **Play a standard 52-card deck** on
the Library page builds a real poker deck (four suits, A to K, drawn by code in
the recognisable layout: pips where real cards put them, red hearts/diamonds,
black clubs/spades) with a classic generated back, and puts the pack face-down
on the felt. Shuffle, cut, deal, draw, flip — blackjack, poker, hearts, rummy
and other standard games are playable from the first visit.

- Deck art is generated on the canvas (`src/domain/standard-deck.ts` holds the
  pure rank/suit/pip layout, `src/features/library/standardDeck.ts` draws and
  stores the cards as normal image assets).
- Because they are ordinary cards and decks, you can rename them, duplicate
  them, change the back, or add more copies — the standard deck is just a
  starting point, not a special case.

## The table feels like a table

- **Felt surface** — deep felt green by default (blue felt, red felt, wood, dark
  and light options too), with a subtle fuzz, a lighter centre and a darker rim.
  The felt is the whole table: it fills the window, so panning never runs into
  an edge. Cards can be placed anywhere.
- **Sounds** — synthesised with the Web Audio API (no audio files, so nothing to
  download and nothing that breaks offline use): a riffle when you shuffle, a
  snap when a card flips, a soft thwip as cards are dealt, a clack when a card
  joins a stack, a rustle when you pick a card up. Toggle **Sound on/off** in the
  header.
- **Shuffle animation** — the pack splits into two halves that counter-rotate
  like opposing propellers (the Tabletop Simulator shorthand for a riffle), for
  500 ms.
- **Dealt cards land slightly off-square** (±2°), like a real deal, and are
  pulled square again when Snap is on.
- **Soft grid snapping** — with **Snap on**, a card you are dragging is pulled
  to the nearest grid line (pitch = that card's own size) or to a card it is
  already near — its centre or its edge — but only if it is within about a third
  of a card. Anything further off stays exactly where you put it. Faint guide
  lines appear only while a card is in your hand.
- **Cut** — split a stack in two from the stack menu, like cutting a real deck.
- **Work with a group** — tap cards to select them (Shift+tap to add or remove),
  Shift-drag across the felt to rubber-band a selection, or turn on **Select
  mode** and do both with a finger. Then **Gather into a pile**, **Arrange in a
  row**, **Arrange in a grid** or **Return to deck**. Grabbing any card in the
  group drags the whole group with it.
- **Focus mode** — **Focus table** in the header hides the toolbar, the tips and
  the deck tray and lets the felt fill the whole window (handy on a tablet). The
  floating **Controls** panel next to the zoom buttons still has Undo, Redo,
  Draw direction, Surface, Snap, Select mode, Clear table, Library, Workshop and
  a Launch button for every deck. **Esc** or **Exit focus** brings the interface
  back (Esc first clears any selection).

## Setup

```bash
npm install
npm run dev        # local dev server (http://localhost:5173/)
npm run lint       # ESLint
npm run typecheck  # strict TypeScript
npm test           # Vitest (domain logic + schemas)
npm run test:e2e   # headless-Chromium table smoke test (needs: npx playwright install chromium)
npm run build      # production build into dist/
npm run preview    # preview the built app
```

## Deployment (GitHub Pages)

**Live now:** https://mgonzalvez.github.io/dealwithit/

1. Push to the `dealwithit` repository.
2. GitHub Pages is set to **GitHub Actions** — the `deploy.yml` workflow
   builds and publishes `dist/`.
3. For the custom domain: add a DNS CNAME record for `dealwithit.gonzhome.us`
   pointing to `mgonzalvez.github.io`, and keep `public/CNAME` in the repo.
   That record is not in place yet, so the custom domain currently does not
   resolve.

### Build modes

The default build uses a **relative base (`./`)**, so one artifact works at both
the repo subpath and a custom-domain root — no separate builds needed.

| Mode | Base | Command |
|---|---|---|
| Anywhere (`mgonzalvez.github.io/dealwithit/` or `dealwithit.gonzhome.us`) | `./` | `npm run build` (default) |
| Absolute root (only if you need `/assets/...` paths) | `/` | `VITE_BASE=/ npm run build` |

The app uses hash routing (`#/library`, `#/workshop/<id>`, `#/table/<id>`) so
GitHub Pages deep links never 404.

## Architecture snapshot

- **Vite + React + TypeScript (strict)**, Zustand for state, Dexie/IndexedDB
  for persistence (image blobs live in IndexedDB, never localStorage).
- **Domain layer is pure functions** (`src/domain/`): deck recipes are
  immutable templates; table operations create independent card instances and
  never mutate recipes. Shuffling is Fisher–Yates with
  `crypto.getRandomValues` (rejection sampling, unbiased).
- **Milestones**: M0 scaffold, M1 image/ZIP import, M2 Workshop, M3 Table,
  M4 export/import, M5 PWA/offline, M6 Card Extractor bridge, M7 generated card
  backs, M8 workflow clarity (one "Choose a back" picker + toggleable inline
  tips), M9 table realism (felt, sounds, shuffle/deal animation, soft snapping,
  cut), M10 built-in standard 52-card deck — all done. See
  `IMPLEMENTATION_STATUS.md`.
- **Card backs can be generated, not just uploaded.** Everywhere a back is set,
  one button — **Choose a back** — opens a picker with three tabs: Generate a
  pattern (style → colour → game name), Use an image you already imported, or No
  back. Generated designs are stored as JSON and drawn from a seeded PRNG, so
  they look identical on every device and add nothing to export size. A card's
  own back beats the deck's back; with neither, cards show a proper generic back
  (lattice, double frame, centre emblem) rather than a grey rectangle.
- **The Table simulates a real table.** Deep felt surface with subtle fuzz, a
  riffle sound and a propeller shuffle, a thwip when cards are dealt (they land
  slightly crooked, ±2°), a snap when cards flip, and soft "magnetic" grid
  snapping. See `docs/table-realism-spec.md`.
- **You can play without uploading anything.** **Play a standard 52-card deck**
  builds A–K in four suits with recognisable pip layouts and a classic back, then
  puts the pack on the felt.
- **Workshop is visual**: card tiles render actual card art (click to flip
  front/back, bulk back assignment), decks appear as fanned thumbnail stacks
  with quantity steppers, reorder, deck icons and deck-to-deck transfer.
- **Routing** supports Workshop tabs: `#/workshop/<id>/import|cards|decks`.

## Tradeoffs

- Table rendering starts as HTML/CSS transforms (simple, debuggable); PixiJS
  is only considered if benchmarks demand it.
- Table sounds are synthesised with the Web Audio API rather than shipped as
  audio files: smaller bundle, works offline, no licensing questions. If a real
  recording is ever wanted, drop it in `public/sounds/` and swap the synth call.
- SVG import is excluded in the MVP (rasterizing safely is non-trivial).
- No speculative Card Extractor API: generic image/ZIP import ships first;
  the bridge waits for the real export contract.
- Empty stacks are removed on the table (MVP behaviour) rather than left as
  placeholders.
- Demo artwork is rendered at runtime from the bundled Fractal Symbols icon
  set (CC BY 4.0, attribution below) — small, safe, and no licensing risk.

## Installable & offline (PWA)

Production builds register a service worker that caches the app shell, so
Deal With It launches offline after the first visit and can be installed from
iPad Safari (Share → "Add to Home Screen") or Chrome/Edge (install prompt).
Your cards and projects stay in IndexedDB; nothing is uploaded.

```bash
npm run icons   # regenerate PNG app icons (192/512)
```

## Portable projects

Each project can be exported from the Library as a self-contained
`<name>.dealwithit.zip` (manifest + every original image + decks + table
state, with checksums). Importing that archive on any device restores the
project exactly; IDs are remapped so the same archive can be imported
devices repeatedly without collisions. Ordinary image ZIPs (including Card
Extractor exports) still import through the Workshop.

## Documentation

| Document | What it covers |
|---|---|
| `Deal_With_It_Final_Codex_Build_Spec.md` | The original product spec (milestones, data model, constraints) |
| `IMPLEMENTATION_STATUS.md` | Milestone-by-milestone status and verified gates |
| `docs/card-back-designer-spec.md` | Generated card backs: the one "Choose a back" picker, data model, precedence, tutorial tips |
| `docs/table-realism-spec.md` | Felt surfaces, synthesised sounds, propeller shuffle, deal jitter, soft grid snapping, cutting, the generic back, the built-in standard 52-card deck |
| `to-do.md` | Open questions and the next realism tweaks |

## Artwork attribution

Deck icons and demo card artwork use the **Fractal Symbols** board game icon
library by Felix Thalin (<https://fractalsymbols.com>), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The same set is
used by TokenMaker and Prototyper. SVGs live in `public/deck-icons/` and are
normalized to `fill: currentColor` for theme adaptation.

## Privacy

Everything is stored locally in your browser (IndexedDB). Nothing is uploaded
to any server unless you explicitly export a project file. Browser storage
can be evicted (especially on Safari); export your projects regularly. You
are responsible for the rights to the card images you import.
