# Table Realism — Feature Spec

**Feature:** make the virtual table feel like a real card table — the surface, the sounds, the way cards shuffle, deal, flip and line up.

**Implemented:** 2026-11-07 (M9), 2026-11-07 (M10, the built-in standard deck), 2026-11-07 (M11–M12: interaction fixes, the endless felt and focus mode).
**Files:** `src/features/table/sounds.ts`, `src/features/table/snap.ts`, `src/styles/table.css`, `src/features/workshop/cardRenderer.ts`, `src/domain/table-operations.ts`, `src/domain/models.ts`, `src/domain/standard-deck.ts`, `src/features/library/standardDeck.ts`, `src/app/App.tsx`.

---

## 1. The surface

Default table background is **deep felt green `#15372a`**. Tables saved with the old `#4a5b4f` are migrated on load.

| Surface | Colour | Texture |
|---|---|---|
| Deep felt green | `#15372a` | subtle SVG fractal fuzz (10% opacity) + light centre, dark rim |
| Blue felt | `#1f3a52` | same felt fuzz |
| Red felt | `#5a2b2b` | same felt fuzz |
| Wood | `#7a5c3f` | grain lines (two repeating gradients), no fuzz |
| Dark | `#22262b` | lighting only |
| Light | `#e8e3d8` | lighting only |

The lighting is a radial gradient (brighter where the "light" hits, darker toward the rim) plus an inset shadow. There is no table edge/rail, by design.

### The felt is endless

The surface is painted on the **canvas** (which is the viewport), not on the world layer, so panning never reveals an edge. The card layer is a pure transform: `translate(camera) scale(zoom)` with no fixed 1600×1000 rectangle.

`TABLE_WIDTH` / `TABLE_HEIGHT` (1600×1000) survive only as the default starting area. Positions are allowed anywhere within `WORLD_LIMIT = 6000` units in either direction (≈ 47 cards wide), so cards can never be lost to an absurd coordinate, but there is no wall to bump into. `moveObject`, `duplicateObject` and `returnToDeck` clamp to that limit rather than to the old board rectangle. `returnToDeck` now reassembles the cards where they were, not at a fixed table centre.

Cards are launched at the middle of whatever the player is currently looking at (`viewCentre()`), and the camera re-centres on the cards when the window is resized or focus mode is toggled.

Cards sit on the felt: stacks get a wider, warmer shadow than loose cards.

## 2. Sounds (synthesised, no files)

`src/features/table/sounds.ts` builds every sound from two ingredients: a **filtered noise burst** (the scrape of cardboard) and a **short low sine** (the thud of a card meeting felt).

| Action | Sound |
|---|---|
| Pick a card or stack up | soft two-part rustle of cardboard |
| Flip / rotate | snap burst (2200 Hz → 900 Hz) + 160 Hz thud |
| Shuffle | 14 riffle clicks at random spacing (~0.5 s) then a square-up clack + thud |
| Deal | swoosh (1800 Hz → 420 Hz) + 130 Hz landing thud, staggered 150 ms per card |
| Draw (peel off a stack) | distinct flick + small thud |
| Set a card down on the felt | low 110 Hz thud + short scrape |
| Merge into a stack / gather | clack + thud |
| Cut | two short clacks + thud |

- **Sound on/off** is a global control in the header (next to *Tips*), persisted in the settings store as `sound`. It is not per-table: the table is one sandbox, and a per-table mute would be one more thing to forget.
- Master gain 0.6.
- No audio files, so nothing to download and nothing that breaks the offline PWA shell.
- Browsers refuse to start audio before a user gesture. The AudioContext is created on the first pointer event anywhere in the app (`primeAudio()` in `src/app/App.tsx`), so the very first shuffle or flip is not swallowed.
- **Trap to remember:** a real `BiquadFilterNode` exposes `Q` through a getter only. `filter.Q = 1.1` throws — and because sounds are called from the pointer handlers, that exception killed dragging on the table. `src/test/sounds.test.ts` runs every sound against a stub AudioContext that behaves like the real one, so this class of bug fails in CI rather than in the browser.

## 3. Shuffle: the propeller riffle

On shuffle the stack keeps its full back underneath while two clipped halves (left/right) **counter-rotate** — up to ±8°, then settle — and the pile layers fan out and come back. 500 ms, matched to the riffle sound. Keeping the whole back painted below the halves is what stops the pack from looking like it has been sliced in two; this is the Tabletop Simulator shorthand for shuffling: not physically accurate, but it reads instantly as "the deck is being shuffled".

`prefers-reduced-motion` disables the animation.

## 4. Dealing

`dealFromStack()` places dealt cards 80 units apart in rows of 8, each with a **±2° random rotation** (`landingJitter()`), and each card plays a thwip 150 ms after the previous one, dropping in with a 300 ms animation.

## 5. Soft grid snapping

`src/features/table/snap.ts` — pure, tested logic:

- **Pitch** = the dragged card's own width (x) and height (y), anchored at the table origin.
- **Anchors** = positions of every other object on the table, so cards also line up with each other, not just with arithmetic grid lines.
- **Tolerance** = `min(20% of the card size, 20 units ≈ 10 mm)`. Inside that band the card is pulled to the line; outside it, the card stays exactly where you put it.
- Applied **live while dragging** (magnetic), not only on release.
- On release, rotation is straightened to the nearest 90° if it is within 4° (`snapRotation`).
- The toolbar shows **Snap on/off**; the choice is persisted (`tableSnap`).
- Faint guide lines are drawn **only while a card is being held**, sized to that card, at 5% opacity.

## 6. Cutting a deck

`cutStack(stack, objects, fraction = 0.5)` lifts the top half of a stack and sets it beside the lower half, preserving instance order and the deck reference. Available from the stack context menu (**Cut**) and the stack action bar. The deck recipe is never modified.

## 7. The generic back

If neither the card nor its deck has a back, `drawNeutralBack()` renders a believable generic playing-card back: dark blue base, diamond lattice, double frame, and a centre emblem (a diamond inside a circle). No flat grey rectangles anywhere.

Precedence (`resolveBack`): card image → card generated design → deck image → deck generated design → generic back.

## 8. Built-in standard 52-card deck

`src/domain/standard-deck.ts` is a pure spec: four suits (hearts ♦ clubs ♠ colours, glyphs), thirteen ranks, and a `pipLayout(rank)` returning normalised pip positions approximating a real card.

`src/features/library/standardDeck.ts` draws each card on a 635×889 canvas (rank + suit glyph in the top-left corner, the same block rotated 180° bottom-right, pips in the middle, a monogram frame for J/Q/K), saves it as an ordinary PNG asset, creates 52 card definitions at poker size (63.5 × 88.9 mm), one deck with a classic blue diamonds back, and a table with the pack already face-down in the middle.

It is deliberately minimalist but immediately recognisable, so a first-time visitor can play poker, blackjack, hearts or rummy without uploading anything.

## 9. Tests

- `src/test/snap.test.ts` — 9 tests: snap/near-miss behaviour, neighbour alignment, negative coordinates, looser tolerance, rotation straightening, graceful no-op without an audio device.
- `src/test/standard-deck.test.ts` — 6 tests: 52 unique cards, 13 per suit, real card names, red/black suits, correct pip counts, pips inside the card and never overlapping.
- `src/test/table-operations.test.ts` — cutting a deck (halves, order preserved, deck reference kept) and deal jitter bounded by ±2°.
- `src/test/sounds.test.ts` — 3 tests against a stub AudioContext that mimics the real one (getter-only `Q`): every sound builds nodes without throwing, the riffle is busier than a single flip, and muting creates nothing.
- `scripts/e2e-table.mjs` (`npm run test:e2e`) — a headless-Chromium smoke test that starts Vite itself and drives real pointer events: the camera frames the deck, the face-down top card is a real back (not blank stock), the count badge sits on top of the pile, dragging peels a card off a stack, holding grabs the whole deck, shuffle riffles and animates, double-click flips, cut and set-down make sounds, the header Sound toggle silences everything, focus mode fills the viewport and hides the chrome, and the Controls panel still offers decks, surface and undo. Exits non-zero on failure.

## 10. Focus mode (the table gets the screen)

**Why:** on a tablet — or on a desktop monitor that is too small for a big spread — the interface eats the space the cards need.

**How it works:**

- **Focus table** in the header (and **Exit focus** once you are in it). Keyboard: **Esc** closes the context menu, then the Controls panel, then leaves focus mode.
- The header collapses to a slim bar with just the brand mark, Sound and the theme toggle. Navigation, the "More tools" menu and the Tips toggle are hidden because they have nothing to explain in focus mode.
- The table toolbar, the coach tip and the deck tray disappear; the canvas goes edge-to-edge (`main` padding 0, no border, no radius).
- Everything the toolbar held is reachable from the floating **Controls** panel next to the zoom buttons: Undo, Redo, Draw face up/down, Surface, Snap, Clear table, Library, Workshop, and a **Launch** button for every deck.
- The preference is remembered (`tableFocus` in the settings store), so the table opens the way you left it.
- Re-centering happens automatically when focus is toggled and when the window is resized or the tablet rotates, so cards never end up stranded off-screen.

## 11. Deliberate non-goals

- No audio assets, no streaming, no volume slider yet.
- No true two-half interleaving riffle (propeller shorthand is enough for the feel).
- No rigid snapping, no table rails, no ambient table lighting beyond the felt gradient.
- No browser `requestFullscreen()`: focus mode already uses the whole viewport, and forcing fullscreen behaves badly in iPad Safari.
