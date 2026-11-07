# Table Realism — to-do list

_Last updated: 2026-11-07 (decisions recorded after the "make the table feel real" session)_

Legend: ✅ shipped · 🔶 shipped, tune later · ⬜ not built yet

---

## 1. Face-down decks must show the real card back — ✅

- The stack's top card is drawn from `resolveBack(card, deck)` using the stack's **own** `sourceDeckId`. The old face cache keyed faces by card only (using the first deck that happened to contain it), which is why a cream back in the Workshop still showed a green back on the table.
- Faces are cached per `card + face + deck`.
- Tray thumbnail is a true render of that deck's back — pattern **or** uploaded image — with a plain label ("Classic diamonds back", "Image back", "Neutral back").

**Still open:** nothing. A card with no back chosen now shows a proper generic back (dark blue lattice, double frame, centre emblem) instead of a flat grey rectangle.

---

## 2. Flip sound — ✅ (synthesised)

Filtered noise burst + low felt thud. Plays on double-click flip, "Flip top" and "Rotate 90°". Master gain 0.42.

**Decisions:** synthesis is fine (no audio files) · volume is right · sounds also play on drag-related actions.
**Later:** if you ever want a real recorded flip, drop a CC-licensed clip in `public/sounds/` and swap the synth call.

---

## 3. Shuffle sound + animation — ✅

- Sound: 12 riffle clicks with random spacing (~0.4 s) ending in a square-up clack.
- Animation: the pack splits into two clipped halves that counter-rotate like opposing propellers (Tabletop Simulator style), while the layers underneath fan out. **500 ms.**

**Decisions:** propeller-style, 500 ms.
**Later ideas:** riffle from the tray before launching; a real two-half split with interleaving.

---

## 4. Deal: gentle "thwip" — ✅

Swoosh + landing thud per card, staggered 150 ms. Cards drop in with a 300 ms animation and land **±2° off-square**, like a real deal.

**Decisions:** 80-unit spacing kept for now · random ±2° landing rotation yes.
**Later:** faster stagger (80 ms) if 150 ms feels slow for big deals.

---

## 5. Table surface — ✅

- Default deep felt green `#15372a`; tables saved with the old `#4a5b4f` migrate automatically.
- Surfaces: Deep felt green, Blue felt, Red felt, Wood, Dark, Light.
- **Subtle** fuzz (SVG fractal noise at 10% opacity), lighter centre, darker rim. No table edge/rail.
- Per-material texture: felt gets fuzz, wood gets grain lines, dark/light stay flat with only the lighting gradient.

**Decisions:** subtle fuzz · no table edge · per-material textures.

---

## 6. Soft ("fuzzy") grid snapping — ✅

- **Snap on/off** in the table toolbar, persisted (`tableSnap`).
- A dragged card is pulled to the nearest grid line (pitch = **that card's own width/height**) **or** to a card already on the table — whichever is nearer.
- Only snaps when within `min(20% of the card size, 20 units ≈ 10 mm)` — deliberately loose.
- **Magnetic while dragging** (applies live, not just on release).
- Rotation straightens to the nearest 90° when within 4°.
- Faint guide lines appear **only while a card is in your hand**, sized to that card.

**Decisions:** card-size pitch · guide only during drag · looser tolerance (20%) · rotation straightening yes · magnetic while dragging.

---

## 7. Cut the deck — ✅

`cutStack()` lifts the top half of a stack and sets it down beside the rest (context menu → **Cut**, and a Cut button in the stack action bar). The deck recipe is never touched. Tested.

---

## 8. Built-in standard 52-card deck — ✅

A one-click **"Play a standard 52-card deck"** in the Library creates a real poker deck (4 suits × A–K, drawn procedurally with recognisable pip layouts, red/black suits, corner rank + suit glyphs mirrored at both ends), a classic generated back, and puts the pack face-down on the felt so you can shuffle, cut, deal and play immediately — no uploads needed.

- Pure spec: `src/domain/standard-deck.ts` (suits, ranks, pip layouts) — unit tested.
- Art + persistence: `src/features/library/standardDeck.ts` (canvas → PNG blobs, stored as ordinary assets/cards/deck).
- Documented in `README.md` under "Play straight away — the built-in standard deck".
- Cards are normal cards: rename, duplicate, re-back, or add copies.

**Later ideas:** Joker support, two decks, a "bridge" size variant, and a small set of rule-free mini-games (e.g. a solitaire layout) as presets.

---

## 9. Extra realism ideas still open

| Idea | Why | Status |
|---|---|---|
| Cards lift and cast a bigger shadow while dragged | Real cards rise off the felt | Partly there (`grabbing` shadow) — deepen? |
| Stack thickness illusion for 52-card piles | A big pile should look thick | ✅ Up to six layers, spaced 2.5 px for big piles; the sides take the deck's back colour |
| Per-table sound setting | Sound is a preference, not a table property | ✅ Decided: global toggle in the header (`sound`) |
| First-sound unlock | Browsers refuse audio before a gesture | ✅ AudioContext primed on the first pointer event app-wide |
| Squaring-up tap animation | A visual "tap" when a stack is gathered | ⬜ Nice-to-have |
| Card backs for the standard deck variants | Red/blue classic backs | ⬜ Add a back selector for the standard deck |

---

## Verified gates

- 108 unit/integration tests across 13 files (snap logic, cutting, deal jitter, standard-deck spec, synthesised sounds, plus everything before).
- `npm run test:e2e` drives headless Chromium through the actual table gestures and checks the sounds each one makes.
- Lint, typecheck, build and Pages deploy all green.
- Standard card art and the neutral back checked by rendering in headless Chrome.

## Manual test checklist

1. Library → **Play a standard 52-card deck** → Table shows a face-down pack with the blue diamonds back.
2. Shuffle → propeller split + riffle sound, 500 ms.
3. Deal 5 → staggered thwips, cards land slightly crooked.
4. Drag one of those cards and drop it near the grid line → it straightens to 0°.
5. Drag a card deliberately off-grid → it stays put.
6. Snap off → nothing snaps, no guide lines.
7. Right-click a stack → **Cut** → two piles, each with its own back.
8. Workshop → choose a cream back → Table tray thumbnail and face-down stack both show cream.
