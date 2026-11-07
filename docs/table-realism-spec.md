# Table Realism — Feature Spec

**Feature:** make the virtual table feel like a real card table — the surface, the sounds, the way cards shuffle, deal, flip and line up.

**Implemented:** 2026-11-07 (M9) and 2026-11-07 (M10, the built-in standard deck).
**Files:** `src/features/table/sounds.ts`, `src/features/table/snap.ts`, `src/styles/table.css`, `src/features/workshop/cardRenderer.ts`, `src/domain/table-operations.ts`, `src/domain/standard-deck.ts`, `src/features/library/standardDeck.ts`.

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

Cards sit on the felt: stacks get a wider, warmer shadow than loose cards.

## 2. Sounds (synthesised, no files)

`src/features/table/sounds.ts` builds every sound from two ingredients: a **filtered noise burst** (the scrape of cardboard) and a **short low sine** (the thud of a card meeting felt).

| Action | Sound |
|---|---|
| Flip / rotate | snap burst (1900 Hz → 800 Hz) + 150 Hz thud |
| Shuffle | 12 riffle clicks at random spacing (~0.4 s) then a square-up clack |
| Deal | swoosh (1600 Hz → 420 Hz) + 120 Hz landing thud, staggered 150 ms per card |
| Draw (peel off a stack) | short flick |
| Merge into a stack / gather / cut | clack + thud |

- **Sound on/off** in the table toolbar, persisted in the settings store (`tableSound`).
- Master gain 0.42.
- No audio files, so nothing to download and nothing that breaks the offline PWA shell.
- Browsers require a user gesture before audio can start; the AudioContext is created lazily on the first action, so the first sound plays on your first interaction.

## 3. Shuffle: the propeller riffle

On shuffle the stack renders as two clipped halves (left/right) that **counter-rotate** — up to ±16°, then settle — while the underlying stack layers fan out and come back. 500 ms, matched to the riffle sound. This is the Tabletop Simulator shorthand for shuffling: not physically accurate, but it reads instantly as "the deck is being shuffled".

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

## 10. Deliberate non-goals

- No audio assets, no streaming, no volume slider yet.
- No true two-half interleaving riffle (propeller shorthand is enough for the feel).
- No rigid snapping, no table rails, no ambient table lighting beyond the felt gradient.
