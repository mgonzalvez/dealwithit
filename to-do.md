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
- Only snaps when within `min(35% of the card size, 45 units ≈ 22 mm)` — magnetic enough that a card a third of the way off the line jumps onto it, loose enough that a deliberate placement stays put.
- **Magnetic while dragging** (applies live, not just on release).
- Anchors are the **centres and the edges** of the cards already on the table, so a card dropped beside another lines up edge-to-edge instead of drifting half a card away. Cards travelling with a group are not anchors.
- Rotation straightens to the nearest 90° when within 6°.
- Faint guide lines appear **only while a card is in your hand**, sized to that card.

**Decisions:** card-size pitch · guide only during drag · tolerance raised from 20% to 35% (capped at 45 units) · edge anchors as well as centres · rotation straightening 6° · magnetic while dragging.

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
| Deeper "lift" shadow while dragging | Cards rise off the felt | 🔶 Grab shadow exists; could be more pronounced |

---

## 10. No table edges — ✅

**Asked for:** "I prefer not to have defined boundaries for the table edges… dragging the table around doesn't show the edges."

- The felt is painted on the canvas (the viewport), not on a 1600×1000 world rectangle, so panning never reveals a boundary.
- Cards can live anywhere within ±6000 units (`WORLD_LIMIT`) — about 47 cards across — which is effectively unlimited for a card table but keeps a stray drag from losing a card forever.
- Decks launch at the middle of the current view rather than a fixed spot.
- The camera re-centres on the cards when the window is resized, the tablet rotates, or focus mode is toggled.

**Decisions:** no rails, no hard edge, no scrolling "table" metaphor — the felt simply is the screen.

---

## 11. Focus mode (full-screen table) — ✅

**Asked for:** an option to go full screen on a tablet or give the table more room on a computer by minimising the UI.

- Header button **Focus table** / **Exit focus**; **Esc** also exits.
- In focus mode: the header becomes a slim bar (brand mark, Sound, theme), the toolbar, the coach tip and the deck tray are hidden, and the canvas runs edge-to-edge.
- A floating **Controls** panel beside the zoom buttons carries Undo, Redo, Draw face up/down, Surface, Snap, Clear table, Library, Workshop and a Launch button per deck.
- Preference persists (`tableFocus`).

**Decisions:** keep Sound and theme reachable in focus mode; hide Tips (there is nothing to coach). Not using the browser `requestFullscreen()` API — iPad Safari does not support it and focus mode already uses the whole viewport.

**Later ideas:** an option to hide the slim header entirely; a bottom deck strip that floats over the felt; auto-focus when the viewport is tablet-sized.

---

## 12. Groups: select, arrange, pile, return — ✅

You can now grab a **group of cards** and do something to all of them at once, with mouse or finger.

**Selecting**
- Tap/click a card to select it. **Shift+tap** adds or removes one.
- **Select mode** (toolbar / focus Controls panel) makes every tap add to the group — the touch-friendly way — and turns a drag on empty felt into a rubber-band box.
- **Shift + drag** on the felt rubber-bands a selection (desktop).
- **Select all cards** button, and **Ctrl/Cmd+A**. Tap empty felt or press **Esc** to clear.

**Group actions** (the bar that appears when two or more cards are selected)
- **Gather into a pile** — `gatherGroup()`; if a stack is in the group, the others are absorbed into it.
- **Arrange in a row** — `arrangeInRow()`, left-to-right, one card width + 14 units apart, at one height.
- **Arrange in a grid** — `arrangeInGrid()`, roughly square (`ceil(sqrt(n))` columns), reading order preserved.
- **Return to deck** — `returnGroupToDeck()`, cards go back to the stack they came from (or form a new one).
- **Deselect**.

**Group dragging:** grab any card in the group and the whole group moves with it, keeping the relative layout.

**Stacks:** a selected stack now has **Deal into a row**, which deals up to 10 cards off the top and lays them out in a tidy row with the staggered deal sound.

**Decisions:** selection is a set, not a single card · group actions are pure functions in `table-operations.ts` (unit tested) · rubber-band selection is opt-in on touch so it never fights panning.

---

## 13. Touch-first table — ✅

A finger is not a mouse. Everything on the table now has a touch path that feels as good as the desktop one.

**Pinch to zoom.** Two fingers on the felt scale the world by the ratio of how far apart they travelled, anchored at the midpoint of the pinch, so the bit you pinched on stays under your fingers. `src/features/table/pinch.ts` holds the maths (clamped 20%–300%). The pinch starts no matter where the first finger landed — on felt or on a card — and cancels whatever that finger was doing.

**Forgiving taps.** A finger is clumsy. A tap that misses a card by up to ~18 screen units grabs the nearest one instead of deselecting. Holding a stack with a finger takes a full second to grab the whole pack (700 ms with a mouse) so a normal tap never accidentally lifts the deck.

**Spacing.** Snap never used to leave a gap: cards either touched or sat a whole card apart. The toolbar and the focus Controls panel now have a **Spacing** control — Tight (6% of the card), Normal (18%), Wide (35%) — and the grid pitch, the neighbour anchors and Arrange in a row / grid all use it. The gap scales with the card you are holding, so a mini card and a bridge card both feel right. Persisted as `tableSpacing`.

**Never re-swallow a peeled card.** If you drag the top card off a deck and set it down a millimetre later, it does not slide straight back in — a card that came off a stack needs 85% overlap to rejoin it, while an unrelated stack needs only 60%.

**Decisions:** pinch maths lives in `pinch.ts` so it is unit-testable · `touch-action: none` on every card so a finger never scrolls the page · e2e touch test drives real CDP touch events, not mouse clicks.

---

## Verified gates

- 130 unit/integration tests across 14 files (snap logic, spacing, pinch maths, cutting, deal jitter, standard-deck pip layout, synthesised sounds, plus everything before).
- `npm run test:e2e` drives headless Chromium through the actual table gestures and checks the sounds each one makes (27 checks).
- `npm run test:e2e:touch` drives the table with **real touch events** (CDP): tap to select, finger-drag to peel, pinch to zoom, Select-mode rubber-band, near-miss taps (14 checks).
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
9. Drag a stack well past where the old 1600×1000 board ended → it stays put; **Fit cards** brings it back into view.
10. Header → **Focus table** → the felt fills the window, toolbar/tips/tray vanish, **Controls** still has Undo, Surface and Launch; **Esc** restores everything.
11. Tablet: pinch the felt with two fingers → the table zooms around the pinch point, the zoom badge follows.
12. Tablet: tap a card, tap another card in Select mode → both selected, group bar appears.
13. Toolbar → **Spacing: Wide** → drag a card next to another; it settles beside it with visible breathing room rather than flush against it.
14. Drag the top card off the deck and drop it back a hair off-centre → it stays a separate card, it does not get sucked back into the pile.
