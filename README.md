# Deal With It

**The Print-and-Play Card Sandbox** — *Make your decks. Play your cards.*

Deal With It is a free, browser-based, local-first card-game sandbox for
Print-and-Play gamers. Upload card images (one at a time, in bulk, drag/drop
or paste) or import a ZIP (including Card Extractor exports), assemble decks
in the Workshop, then play on a virtual Table: shuffle, draw, flip, drag and
stack. No rules engine, no accounts, no backend — your files stay on your
device unless you export them.

Intended public address: **https://dealwithit.gonzhome.us** (GitHub Pages with
a custom domain; DNS setup is documented below and not yet verified).

> **A nod to CardWarden** — Deal With It was inspired by CardWarden, Michael
> Azzara's pioneering iPad card-game sandbox. It carries forward the idea that
> playing your own card games digitally should be simple, flexible, and fun.
> An independent project from GonzHome. (Attribution of inspiration only; no
> affiliation, endorsement, or shared assets.)

## Setup

```bash
npm install
npm run dev        # local dev server (http://localhost:5173/dealwithit/)
npm run lint       # ESLint
npm run typecheck  # strict TypeScript
npm test           # Vitest (domain logic + schemas)
npm run build      # production build into dist/
npm run preview    # preview the built app
```

## Deployment (GitHub Pages)

1. Push to the `dealwithit` repository.
2. Enable GitHub Pages (source: GitHub Actions — the `deploy.yml` workflow
   builds and publishes `dist/`).
3. For the custom domain: add a CNAME record for `dealwithit.gonzhome.us`
   pointing to your GitHub Pages hostname (`mgonzalvez.github.io`), and keep
   `public/CNAME` in the repo. Verify DNS resolves before claiming the site
   is live.

### Build modes

| Mode | Base | Command |
|---|---|---|
| Custom domain root (`dealwithit.gonzhome.us`) | `/` | `VITE_BASE=/ npm run build` |
| Repo subpath preview (`mgonzalvez.github.io/dealwithit/`) | `/dealwithit/` | `npm run build` (default) |

The app uses hash routing (`#/library`, `#/workshop/<id>`, `#/table/<id>`) so
GitHub Pages deep links never 404.

## Architecture snapshot

- **Vite + React + TypeScript (strict)**, Zustand for state, Dexie/IndexedDB
  for persistence (image blobs live in IndexedDB, never localStorage).
- **Domain layer is pure functions** (`src/domain/`): deck recipes are
  immutable templates; table operations create independent card instances and
  never mutate recipes. Shuffling is Fisher–Yates with
  `crypto.getRandomValues` (rejection sampling, unbiased).
- **Milestones**: M0 scaffold (done), M1 image/ZIP import, M2 Workshop,
  M3 Table, M4 export/import, M5 PWA/offline, M6 Card Extractor bridge
  bridge. See `IMPLEMENTATION_STATUS.md`.

## Tradeoffs

- Table rendering starts as HTML/CSS transforms (simple, debuggable); PixiJS
  is only considered if benchmarks demand it.
- SVG import is excluded in the MVP (rasterizing safely is non-trivial).
- No speculative Card Extractor API: generic image/ZIP import ships first;
  the bridge waits for the real export contract.
- Empty stacks are removed on the table (MVP behaviour) rather than left as
  placeholders.
- Demo artwork is generated procedurally at runtime — no bundled third-party
  images, no licensing risk.

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

## Privacy

Everything is stored locally in your browser (IndexedDB). Nothing is uploaded
to any server unless you explicitly export a project file. Browser storage
can be evicted (especially on Safari); export your projects regularly. You
are responsible for the rights to the card images you import.
