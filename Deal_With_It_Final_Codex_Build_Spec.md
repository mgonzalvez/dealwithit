# Deal With It — Final Build Specification

Version: 3.0 FINAL (2026-11-01) | Canonical product: Deal With It | Target: https://dealwithit.gonzhome.us | Deployment: GitHub Pages static site

## 0. Instructions to agent
You are the lead engineer and UX implementer. Build a working, tested, polished application, not a mockup. Read this specification fully, then inspect the repository. Preserve existing code if this is an established repository. If starting from scratch, use the architecture below. Implement milestones sequentially and commit after each verified milestone if git is configured. Do not add a backend, login, telemetry, multiplayer, or rules engine. Prefer simple, maintainable code over abstractions. Document every setup command and tradeoff in README. If Card Extractor's actual export contract is unavailable, implement the documented generic file/ZIP import first and leave a well-defined adapter; never invent its API.

## 0A. Final product identity, naming, and tribute (mandatory)
- **Public product name:** **Deal With It** (title case in prose and browser title); wordmark may use **dealwithit.** (lowercase with a terminal period) as a deliberate visual treatment, not a different product name.
- **Canonical URL:** `https://dealwithit.gonzhome.us` (custom domain routed to GitHub Pages). **Suggested repository:** `dealwithit`. Use this name in README, package metadata, PWA manifest, install prompt, browser title, navigation, About, export filenames and user-facing help. Do not display the old working title "CardTable Workshop" in the shipped interface.
- **Descriptor:** `The Print-and-Play Card Sandbox` for landing page, metadata, and About. **Tagline:** `Make your decks. Play your cards.` These are brand copy, not technical requirements.
- **Personality:** welcoming, lightly witty and self-aware, but never at the expense of discoverability. Primary actions remain plain-language labels: `Upload Images`, `Import ZIP`, `Workshop`, `Play on Table`, `Shuffle`, `Draw`, `Flip`, `Save`, `Export`. Avoid joke labels for critical controls, errors, accessibility text or destructive actions.
- **Core navigation:** `Library` → `Workshop` → `Table`, with prominent import choices. Workshop and Table are named areas, not separate products.
- **About screen tribute**, clearly labeled and distinct from the product identity:

  > **A nod to CardWarden**  
  > Deal With It was inspired by CardWarden, Michael Azzara's pioneering iPad card-game sandbox. It carries forward the idea that playing your own card games digitally should be simple, flexible, and fun.  
  > An independent project from GonzHome.

  This tribute is attribution of inspiration only; do not imply endorsement, affiliation, a sequel, ownership of CardWarden assets, or compatibility with proprietary CardWarden file formats. Do not reuse its branding or artwork.
- **Brand assets:** create original lightweight SVG logo/app icon (e.g. a small fan of playing cards with a subtle deal/motion motif). Do not copy CardWarden assets. Ship accessible light/dark variants, 192px/512px PWA icons, and a favicon. Avoid a font dependency if a system stack works well.
- **Domain/deployment:** implement both GitHub Pages project-path builds and custom-domain root deployment. Use a configurable Vite base (`/` for `dealwithit.gonzhome.us`; `/dealwithit/` for repository Pages preview). Include `public/CNAME` containing `dealwithit.gonzhome.us` when custom-domain deployment is selected, and document GitHub Pages + DNS steps. Do not claim DNS is configured or domain is live until verified. Preserve correct asset URLs, manifest scope, service-worker scope and SPA navigation in both modes.
- **Project package:** new exports should default to `.dealwithit.zip` and `format: "dealwithit-project"`, `version: 1`. The ordinary image ZIP import remains format-agnostic. Support legacy `.cardtable.zip`/`cardtable-import` manifests as *optional migration aliases* only if an earlier prototype actually used them; otherwise do not build speculative compatibility. Keep format versioning independent of display name so future rebrands don't break user projects.
- **GonzHome ecosystem:** link to `https://gonzhome.us` and `https://extractor.gonzhome.us` where relevant. Never assume access to other subdomains' browser storage. Future links to Card Prototyper, Card Formatter, TokenMaker, Dicemaker, and BoardSplitter must be confirmed before hardcoding endpoints.
- **Search/disambiguation:** the phrase "Deal With It" is used by unrelated games/products. The subtitle and GonzHome attribution should appear in metadata/About. Do not claim exclusivity or trademark clearance.

## 1. Product concept
A free, browser-based, iPad-friendly, local-first alternative to CardWarden. A user either uploads individual card images directly (single-file, multi-file, drag/drop or paste) OR imports a ZIP of images (including an export from Card Extractor), corrects artwork, makes one or more decks, then enters the Table to shuffle, draw, flip, fan, arrange and play. No rule enforcement. The physical-card metaphor is the core design principle.

**Primary flow:** Home / Library → Create Game → Choose Upload Images or Import ZIP (equal prominence) → Workshop (Cards and Decks) → Play Table → Save/Resume. Optional link: Open Card Extractor in a separate tab.

**Product boundaries:** Single device, one human operating the table, no hidden multiplayer security, no online sync, no built-in PDF rendering in MVP. Cards may be face up/down, but a single-device game is not secure against peeking.

## 2. Core user stories / acceptance
1. As a player, I can upload ONE individual card image, choose MANY individual images in one picker operation, drag/drop images, or import an image ZIP, with equal UX prominence, progress, duplicate detection and actionable errors. I can repeat any of these methods in any order.
2. I can see all imported cards as thumbnails, select multiple, rotate by 90°, crop/align non-destructively, assign front/back and adjust displayed dimensions.
3. I can create named decks, add cards by drag/drop or multi-select, set quantity per card, reorder cards and assign a default back.
4. I can launch a table containing one or more decks, shuffle a deck, draw a top card, flip a card, drag cards, stack cards and make piles.
5. I can save, close and reopen without losing library, deck composition or table positions.
6. I can export a self-contained game package and re-import it on another device, including all images and current table state.
7. I can use the core flows on iPad Safari with touch only and on desktop with mouse and keyboard.
8. I can run the deployed application under a GitHub Pages repository subpath, offline after the first successful load, without any backend.

## 3. UX / information architecture
### Home / Library
- Grid of game projects, each with cover thumbnail, title, modified date, deck count and Resume / Edit / Export actions.
- Create project; import project; storage usage; concise privacy note: 'Your game files stay on this device unless you export them.'
- Empty state offers 'Import card images' and 'Start with demo deck'.

### Workshop
- Desktop: left asset browser, center card preview/work area, right deck builder and properties; tablet: adaptive two-pane or tabbed layout; phone: functional but secondary target.
- Import panel: three visible entry choices: **Upload Images** (primary, accepts one or multiple files), **Import ZIP** (equally primary), and **Open Card Extractor** (external tool link, clearly labeled). Support drag/drop of single or multiple images anywhere within Workshop, and clipboard paste where browser support permits. Both import methods must share the same staging/validation/progress UI and output pipeline. Preview image count, failed items and duplicate candidates. Accept PNG/JPEG/WebP; SVG only if safely rasterized without executing active content (otherwise exclude). Use `<input type="file" multiple accept="image/png,image/jpeg,image/webp">` for images and a separate ZIP picker; never require ZIP packaging for image upload.
- Asset browser: searchable thumbnails, selection checkboxes, sort by filename/import order, batch actions; **single-image upload is a fully supported primary path, not a fallback**. After each import, let users choose **Add to library only**, **Create cards and add to current deck**, or **Create a new draft deck** (sensible default based on context). Allow mixing sources in any deck and adding more images at any time.
- Card editor: front image, optional back image, 90° rotation, fit/contain vs crop/cover, zoom, pan, crop reset, width/height in mm, lock aspect ratio; changes affect presentation and never overwrite originals.
- Deck builder: deck list, create/rename/duplicate/delete, deck contents, per-entry count, move up/down, default back, card count; drag from library or Add Selected; support reordering with accessible buttons as fallback. Provide **Add Imported Images to This Deck** so users never have to manually re-add a bulk upload. Distinguish Import Image (asset), Create Card (definition), Add to Deck (recipe entry), and Duplicate (increase quantity without copying image blob).
- Explicit 'Play on Table' CTA; on launch offer selected decks and number of copies; warn for empty decks.
- Save indicator and undo/redo for Workshop edits.

### Table
- Fullscreen-like workspace with muted felt/neutral surface and adjustable zoom; lightweight top bar: Library, Workshop, Save, Undo, Redo, Table menu.
- Collapsible tray/palette with project decks, loose cards, card backs and later extensions.
- On tap/click select; drag card or stack; double tap/click card to flip; context menu / action bar: Flip, Rotate 90°, Bring to Front, Send to Back, Duplicate, Move to Stack, Return to Deck, Delete from Table.
- Deck/stack context menu: Shuffle, Draw 1, Draw N, Deal N to area, Flip Top, Peek Top (local-only), Spread, Gather; provide a clear tap-based alternative to complex gestures.
- Visual distinction: deck (stacked backs with count badge), face-up loose card, face-down card, pile/stack. Provide a dedicated discard pile by creating a named stack, not by implementing game rules.
- Zoom/pan: touch pinch zoom; one-finger drag object; two-finger pan canvas; desktop wheel zoom and Space+drag pan. Always provide zoom buttons and Reset View. Prevent browser scroll only during active canvas gestures.
- Simple card snapping is optional and off by default; no grid requirement in MVP.
- Auto-save on meaningful edits, with visible status; separate 'Reset Table' with confirmation.
- Table background color/theme; initial table 1600×1000 logical units, responsive viewport and camera transform.

## 4. Data model and identity
Use TypeScript types and runtime validation (Zod or equivalent). IDs via crypto.randomUUID. Separate immutable asset blobs, editable card definitions, deck recipes and table instances.

```ts
type ID = string;
type ImageAsset = { id: ID; projectId: ID; blobKey: ID; filename: string; mime: 'image/png'|'image/jpeg'|'image/webp'; widthPx: number; heightPx: number; sha256: string; createdAt: number };
type ImageTransform = { rotationDeg: 0|90|180|270; scale: number; offsetX: number; offsetY: number; fit: 'contain'|'cover' };
type CardDefinition = { id: ID; projectId: ID; name: string; frontAssetId: ID; backAssetId?: ID; frontTransform: ImageTransform; backTransform?: ImageTransform; widthMm: number; heightMm: number; tags: string[] };
type DeckEntry = { id: ID; cardDefinitionId: ID; quantity: number };
type DeckDefinition = { id: ID; projectId: ID; name: string; entries: DeckEntry[]; defaultBackAssetId?: ID; createdAt: number; updatedAt: number };
type CardInstance = { instanceId: ID; cardDefinitionId: ID; face: 'front'|'back'; rotationDeg: number };
type TableObject = { id: ID; type: 'card'|'stack'; x: number; y: number; z: number; rotationDeg: number; cardInstances: CardInstance[]; label?: string; sourceDeckId?: ID };
type TableState = { id: ID; projectId: ID; name: string; objects: TableObject[]; camera: { x: number; y: number; zoom: number }; background: string; updatedAt: number };
type Project = { id: ID; name: string; description?: string; schemaVersion: number; createdAt: number; updatedAt: number; activeTableId?: ID };
```

A deck definition is a **recipe**, not a mutable live pile. Launching it creates independent CardInstances. Moving cards between stacks must move instances, never alter deck definitions. Shuffling only changes instance order, using Fisher–Yates with crypto.getRandomValues (unbiased index selection); never shuffle the deck recipe. Define `cardInstances[0]` as bottom and last as top, consistently. Empty stack disappears or remains as an explicit named placeholder according to user choice; MVP can remove it. All table operations should be pure, deterministic functions returning a new state, with tests.

## 5. Technology and deployment
- Vite + React + TypeScript; CSS variables and lightweight handcrafted components. Avoid heavyweight component libraries.
- Zustand (or React context if sufficient) for state; Dexie + IndexedDB for metadata and image blobs. Do NOT store images in localStorage or embed them as base64 in JSON.
- Table rendering: begin with HTML/CSS transformed cards and stacks in a single pan/zoom layer; use pointer events, pointer capture, touch-action management, and CSS transforms. Switch to PixiJS/canvas only if benchmarks demonstrate a need. Avoid giant DOM trees by rendering only table instances and virtualizing Workshop thumbnail lists.
- Image previews via object URLs; revoke URLs on unmount/eviction. Generate cached small thumbnails for library grid. Decode and resize imports in batches to avoid memory spikes; preserve originals for export.
- JSZip or fflate for ZIP ingestion and package export; reject path traversal, unsupported files, extreme expansion and excessive entries; surface file-size warnings and allow cancellation.
- Vitest for pure logic, React Testing Library for key components, Playwright for browser E2E; include WebKit checks where possible and manual iPad Safari test checklist.
- ESLint + Prettier; strict TS; accessible buttons, labels, keyboard alternatives, visible focus states and sufficient contrast.
- GitHub Actions: install, lint, typecheck, test, build, deploy dist to GitHub Pages. Use Vite `base` configured by environment/repo path; verify all routes and assets under `/repo-name/`. Prefer hash routing or simple in-app navigation to avoid GitHub Pages deep-link 404s.
- PWA: manifest, icons and service worker with app-shell precache; do not precache user images. Clearly distinguish offline app shell from browser-local user data.

## 6. Local persistence and export
- IndexedDB schema with projects, imageAssets metadata, assetBlobs, cardDefinitions, deckDefinitions, tables, settings, thumbnails. Include migrations and versioning.
- Debounced autosave after transactions; flush on page visibility change when possible, but never rely solely on unload events. Show unsaved/saving/saved/error.
- On storage quota failure, preserve current in-memory state and display recovery instructions + Export Project action; use `navigator.storage.estimate()` and optionally request persistent storage after user interaction.
- Export `.dealwithit.zip`: `manifest.json` with `format: "dealwithit-project"` and schema version, project JSON, all referenced original image blobs in `assets/<id>.<ext>`, optional thumbnail/preview, checksum metadata. Import validates manifest, IDs, references, archive size and supported version; reject malicious paths and broken references; allow collision-safe project import with remapped IDs.
- Project exports should be reproducible and self-contained. No external URLs required to resume play. Provide export of 'Project + Table' and optional 'Workshop Only' later.
- Explain Safari/browser storage may be evicted, especially under low space or inactivity. Encourage exports; never promise permanent browser storage.

## 7. Import integration with existing Card Extractor
**MVP guaranteed integration:** The user can import individual PNG/JPEG/WebP files **without any ZIP**, and can import ZIP files. Existing Card Extractor is at https://extractor.gonzhome.us; the GonzHome tools index is https://gonzhome.us. Inspect live UI and, where publicly accessible, source before asserting exact archive layout. Support ZIPs containing `fronts/` and `backs/` folders, including a single shared back or multiple backs, as a first-class adapter; also support flat/nested image ZIPs. Do not assume matching front/back names or order without checking real samples. Allow a pairing review screen for ambiguous cases. This works with no cross-origin permissions or modifications to Card Extractor.

**Phase 2 optional one-click integration:** Once actual Card Extractor source/URL/export structure is inspected, implement one of:
A. Card Extractor exports a `.dealwithit.zip` compatible bundle (best robust path);
B. Card Extractor opens Deal With It with a small manifest or payload via `postMessage` only when both apps are intentionally opened in a controlled parent/child window, checking `event.origin`, schema, payload size and explicit user approval;
C. Browser share/import flow where supported.
Avoid passing large image data in query strings, depending on cross-origin localStorage, or assuming cross-site IndexedDB access. Do not invent an API endpoint. Document exact integration contract after reviewing Card Extractor.

Suggested manifest contract for future interoperability:
```json
{
  "format": "dealwithit-import",
  "version": 1,
  "title": "Example PnP Game",
  "cards": [
    { "id": "card-001", "front": "images/card-001.png", "back": "images/common-back.png", "quantity": 1, "deck": "Main Deck" }
  ]
}
```

Deal With It must also import ordinary image ZIPs without manifests. A manifest is an enhancement, not a requirement.

## 8. Interaction specification and edge cases
- Default click/tap selects a card; drag moves it; double-click/tap flips; right-click/long-press opens action menu. Avoid conflicts between long-press and drag; expose always-visible actions for accessibility.
- Drawing from a stack creates/moves the top instance as a face-down loose card offset from the stack; user may flip. Provide a setting for draw face-up vs face-down. Do not automatically reveal hidden card artwork in UI when face down.
- Dropping a card onto a stack merges the instance into that stack, preserving the stack's existing order; top of stack is last. Use a clear hover target, not ambiguous proximity.
- A deck launched to the table starts as one stack, with backs visible and a count. Default face is back even if a card has no custom back; use an app-generated neutral card back.
- Multi-select with Shift on desktop; tap-select mode for touch. Bulk move and bulk flip can be later milestones.
- Rotated/cropped art must display consistently in Workshop, on Table and after export/re-import.
- Undo/redo should include moves, draws, flips, shuffle and stack operations. Store a bounded history of snapshots/commands (e.g. 50) and avoid duplicating image blobs in history.
- Never accidentally delete a card definition when removing a table instance. Confirm destructive project/deck deletion.
- Handle imported duplicate images via hashes; allow same image asset to back many card definitions. Duplicates should be reported, not silently discarded if filenames differ.
- Fail gracefully for corrupted files, zero-card decks, missing images, huge images, interrupted imports, unavailable IndexedDB, and browser storage quota.

## 9. Performance budgets and supported devices
- Target current Safari on iPadOS, Chrome/Edge/Firefox desktop; responsive layout from 768px up, usable narrower layout where practical.
- Target project: 500 unique card images, 10 decks, 300 card instances across a table; avoid arbitrary low product caps. Warn on high memory use rather than imposing legacy 120-card limits.
- Target 60 fps during typical drag/pan with 100 visible objects on a recent iPad; no layout reads inside pointermove; requestAnimationFrame batching.
- Import 100 medium-resolution images without freezing the UI for extended periods; yield between processing batches.
- Lazy-load images and render thumbnail sizes appropriate to use; preserve full-resolution original for card zoom/export.
- Never load all full-resolution assets simultaneously into decoded bitmap memory.

## 10. Visual language
Friendly, clean, practical, modern board-game utility; not a fantasy card game. Default warm neutral surfaces, optional dark mode and tabletop felt colors. Clear hierarchy, 44px minimum touch targets, strong empty states, unobtrusive contextual tools. Workshop uses dense but readable thumbnail grids; Table minimizes chrome. No unnecessary animations, sound effects, achievements or faux 3D. Prioritize precise artwork visibility and legible card text.

## 11. Milestones (implement and validate in order)
### M0 — Scaffold and design system
Vite React TS app, responsive shell, routing, reusable dialog/menu/buttons, basic theme, IndexedDB setup, README, Pages deployment workflow, tests. Demo project accessible.
**Gate:** `npm run lint && npm run typecheck && npm test && npm run build` pass; deployed base path works.

### M1 — Image upload AND ZIP import, asset library (both mandatory)
Build two equally prominent entry points: Upload Images (one image or multiple via native picker, drag/drop, optional paste) and Import ZIP (ordinary ZIP and Card Extractor-shaped ZIP). Shared validation, progress/errors/cancel, natural sorting, hash duplicate detection, persistent blobs, thumbnail grid and preview. Support repeated imports and mixed-source libraries. Users can directly add newly imported cards to an existing or new deck.
**Gate:** Upload 1 PNG, upload 100 mixed PNG/JPEG/WebP files in one action, import a ZIP, then upload 5 more loose images into the same project; reload and find all assets intact, correctly deduplicated without losing intentional card quantities. Both import buttons are visible on desktop and iPad; malformed ZIP does not crash. M1 is INCOMPLETE if only ZIP works or if only image upload works.

### M2 — Card definitions and Workshop
Create cards from imported images, transform/crop/rotate preview, fronts/backs, physical dimensions, batch rotation, editable deck recipes, quantity controls, reorder, autosave.
**Gate:** Create 3 decks with 60+ total cards, reload, verify counts and transformations.

### M3 — Table MVP
Launch deck recipes as stacks, pan/zoom, draw, flip, drag, rotate, shuffle, stack/gather, return to deck, object menu, count labels, save/resume.
**Gate:** Play a full manual solo card sequence without rules automation; reload resumes exactly.

### M4 — Reliable portable projects
Self-contained ZIP export/import, migrations, validation, undo/redo, storage warnings and recovery, keyboard/touch accessibility pass.
**Gate:** Export on desktop, import on iPad, artwork/decks/table match; undo a shuffle/draw/move.

### M5 — PWA and polish
Offline shell, installability, iPad Safari gestures, touch ergonomics, performance tests, guided first-run tutorial and demo game.
**Gate:** Use on iPad without mouse, play offline after install, save/export reliably.

### M6 — Optional direct Card Extractor bridge
Only after inspection of real Card Extractor repository/export contract. Prefer ZIP manifest. No speculative API code.
**Gate:** Extract in Card Extractor → import to Workshop with zero manual per-card steps. Preserve both standalone image upload and ZIP import unchanged.

## 12. Test plan
**Unit:** Fisher–Yates preserves identity and count; draw removes correct top; flip is reversible; merging stacks preserves order; deck recipe untouched by table operations; transforms round-trip; schema migrations; reference validation; natural sort; duplicate hashing.

**Integration:** one-image upload; 100-image multi-select upload; drag/drop 5 images; paste one image when supported; mixed loose-image and ZIP imports into same deck; ZIP import with `fronts/` and `backs/` and ambiguous pairing; ZIP import with nested image folder; 100-image batch; 3 decks with repeated image; front/back assignment; autosave/reload; storage failure; export/re-import round trip; undo/redo after shuffle.

**E2E:** Create project → upload 20 individual image files (not ZIP) → add 5 from ZIP → make 2 decks → launch → shuffle → draw 3 → flip → move to pile → reload → export → re-import. Keyboard-only basic operation; pointer/touch drag; GitHub Pages subpath loading.

**Manual iPad:** Safari portrait/landscape, Photos/Files single image selection, Files multiple image selection, ZIP selection, drag vs scroll, pinch pan/zoom, long press, card zoom, safe-area insets, offline launch, storage persistence warning, export via Files/share sheet.

## 13. Future modules (explicitly NOT MVP)
- Boards/mats: image asset with lockable tabletop background object, layers and alignment.
- Dice: d4/d6/d8/d10/d12/d20, dice trays and roll log; potential integration with existing Dice Maker.
- Tokens/counters: image tokens, numeric counters, quantity pools; integration with Token Maker.
- Board Maker: import board images/tiles, snap and scale.
- Table presets: saved layouts, designated hand areas, discard/exile zones, snap-to-grid.
- Optional PDF-to-card import directly in app using PDF.js (only if performance and UX justify it).
- Multiple tables per game, play-session snapshots, card search, keyboard shortcuts, deck templates.
- Local pass-and-play privacy mode, optional real-time multiplayer only with a separately scoped backend; do not conflate with MVP.

## 14. Non-goals and constraints
No game rules, scoring automation, AI opponents, user accounts, cloud database, DRM, paid services, multiplayer, network dependency, proprietary assets, analytics, advertisements, or copyrighted bundled card art. Demo cards must be original, public domain or clearly licensed. Never upload private PnP files to a server. Explain that users are responsible for rights to images they import/share.

## 15. Suggested repository layout
```
src/
  app/                 # navigation, shell, providers
  components/          # accessible UI primitives
  features/
    library/
    import/
    workshop/
    table/
    export/
  domain/
    models.ts
    deck-operations.ts
    table-operations.ts
    transforms.ts
    schemas.ts
  persistence/
    db.ts
    repositories.ts
    migrations.ts
  integration/
    card-extractor.ts
  styles/
  test/
public/
  demo/
.github/workflows/deploy.yml
```

## 16. Definition of done
The app is genuinely playable, not a visual prototype. A first-time user can upload one image, upload a batch of loose card images, or import a ZIP with equal ease; organize multiple decks, play them on a virtual tabletop, save, resume and export without reading technical documentation. It works on iPad Safari and a GitHub Pages subpath. No backend, no unhandled critical errors, no lost assets in export. Every milestone has passing automated tests and an explicit manual acceptance checklist.

## 17. First action for agent
1. Inspect repository and summarize what already exists.
2. Identify Card Extractor integration details only if its source/URL is available; otherwise explicitly defer.
3. Produce a short milestone implementation plan, then begin M0 and M1 immediately.
4. Do not stop after planning: implement, run tests, fix errors, and report exact completed functionality and commands.
5. Before advancing from M1, demonstrate persistent 100-image import and describe the manual test steps.

## 18. Mandatory import workflow detail (v2 clarification)

### Entry and staging
1. Workshop empty state presents **Upload Images** and **Import ZIP** as visually equal primary actions; **Use Card Extractor** is a secondary external link. The same controls remain available after cards have been added.
2. Upload Images must support one file, multi-select, repeated selection, drag/drop and, if supported, paste. Accept image files directly; never ask the user to create a ZIP.
3. Import ZIP supports a plain ZIP of images, nested folders, and Card Extractor-style `fronts/` and `backs/`. Ignore OS metadata files (`__MACOSX`, `.DS_Store`), reject ZIP-slip paths, and detect unsupported/oversized payloads.
4. Both paths enter a common staging screen showing thumbnails, filename, detected dimensions, possible duplicate status, import errors and optional front/back grouping. The user can import all valid files or deselect some.
5. On completion offer **Keep in Library**, **Create Draft Deck**, or **Add to Existing Deck**; defaults may depend on context, but the choices must remain discoverable. Do not create duplicate deck entries if the user cancels.
6. Subsequent imports can be mixed in any project and any deck. The UI must not label assets as restricted to their source.

### Card assembly and image editing
- A raw image is an asset, not automatically an independent physical card in every context. Card definitions reference a front asset and optional back asset; deck entries reference definitions with integer quantities.
- Provide batch **Create Cards from Selected Images**, one card per selected image, and batch **Add Selected Cards to Deck**. Import-to-deck shortcuts execute these operations together.
- Offer default backs per deck, individual card back overrides, and a neutral generated back. For `fronts/`+`backs/`, propose pairing and allow a user to change it before committing.
- Support non-destructive 90-degree rotation, free crop alignment/zoom/pan, reset, common aspect-ratio presets (poker 2.5×3.5 in, bridge 2.25×3.5 in, square, custom), and batch sizing. Preserve original pixel data.
- Distinguish **Duplicate card in deck** (increase quantity), **Duplicate card definition** (independent edit using shared image blob), and **Duplicate imported image** (normally unnecessary). Avoid silently duplicating blobs.
- Keep edits reversible and previews consistent on Workshop and Table.

### Import contract tests / fixtures
Provide committed or generated **original, non-copyrighted** test images and fixtures: single PNG, 10 separate PNGs, 100 mixed image files, flat ZIP, nested ZIP, ZIP with `fronts/` and one `backs/` shared image, ZIP with multiple backs requiring review, corrupt ZIP, duplicate identical bytes with different filenames, and image with unusual aspect ratio.

### UX safeguards
- On iPad, use a native picker compatible with Files/Photos and make controls at least 44 CSS px. Don't rely on desktop drag/drop.
- Never auto-pair distinct backs based solely on natural sort without displaying a review when pairing is uncertain.
- Show import failures per file and keep successful items; a bad image must not abort a whole batch.
- Use transactional persistence: don't leave orphaned card definitions/deck entries after a canceled import.
- Prevent importing the same image twice from multiplying stored blobs, but let the user intentionally add multiple copies of the same card to decks.

## 19. Release criteria and agent execution discipline
The first usable release must include **both** upload modes, Workshop deck building, and Table play. Do not describe the project as complete after scaffolding or static UI. Before claiming a milestone is complete, run the relevant test commands and show outcomes. If external websites or source repositories are inaccessible, state that and use the documented adapter/fixtures rather than inventing integration behavior. Keep an `IMPLEMENTATION_STATUS.md` with milestone status, verified tests, known gaps and next steps. Prefer small commits with functional vertical slices.

## 20. Final release identity acceptance checklist (v3)
- Browser title, manifest name/short_name, homepage H1, navigation, About, README, repo docs, install UI and download filenames consistently identify **Deal With It**.
- `dealwithit.gonzhome.us` appears as the intended public address, with clear DNS/GitHub Pages setup instructions and no unverified claim that it already resolves.
- The CardWarden tribute appears in About only (and optionally acknowledgments), not as a co-brand or product title.
- Workshop and Table remain distinct, connected experiences; single/multiple individual image upload and ZIP import retain **equal first-class prominence**.
- Both root-domain and repository-subpath builds pass smoke tests; exported projects round-trip across them without asset URL dependencies.
- New exported project archives use `.dealwithit.zip` and a documented versioned manifest; ordinary image ZIPs, including Card Extractor-style archives, remain importable.
- Do not let naming or logo work delay functional import, deck assembly, and tabletop milestones.
