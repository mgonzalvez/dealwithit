# Table Realism — to-do list

_Last updated: 2026-11-07 (after the "make the table feel real" session)_

Legend: ✅ shipped in this pass · 🔶 shipped, needs your call on taste · ⬜ not built yet

---

## 1. Face-down decks must show the real card back

**Request:** when a deck sits face-down on the table, the top card should show the back I chose in the Workshop — generated pattern or uploaded image.

**Status:** ✅ Done.

- The stack's top card is now drawn from `resolveBack(card, deck)` where `deck` is the stack's **own** `sourceDeckId` (previously the face cache used the first deck that happened to contain the card, so a deck-specific back could be wrong).
- Faces are cached per `card + face + deck`, so changing a back is picked up the next time you open the table.
- The tray thumbnail is a real render of that deck's back (pattern **or** image), with a plain-language label underneath: "Classic diamonds back", "Image back", "Neutral back".

**Open:** ⬜ If a deck has **no** back chosen, the fallback is a flat grey rectangle. Should the neutral default be a proper generic card back (subtle border + a small Deal With It emblem)?

---

## 2. Flip sound

**Request:** hear a card flip.

**Status:** 🔶 Done — synthesised (no audio files, so nothing to download, works offline).

Built from a filtered noise burst + a low felt thud. Plays on: double-click flip, "Flip top", "Rotate 90°".

**Open questions**
- Is the volume right? Master gain is 0.42 (roughly −8 dB).
- Do you want a **real recording** instead of synthesis? I'd need a CC-licensed clip (or you can supply one) — files would ship in `public/sounds/`.
- Should flipping a card while **dragging** also make a sound, or only explicit flip actions?

---

## 3. Shuffle: sound + animation

**Request:** a riffle sound and a visible shuffle.

**Status:** 🔶 Done.

- Sound: 12 small riffle clicks with random spacing, ending in a "square up" clack.
- Animation: 700 ms — the stack jitters/rotates a few degrees while the layers underneath fan out and then settle. Disabled automatically when `prefers-reduced-motion` is on.

**Open questions**
- Should the animation actually **split the pack into two halves and interleave** (a real riffle), or is the jitter + fanning layers enough? Splitting needs the stack to be drawn as two separate piles for a moment — a bigger change.
- Duration: 700 ms. Too long for fast play? 350 ms?
- Should shuffle also work from the tray (shuffle before launching)?

---

## 4. Deal: gentle "thwip"

**Request:** a soft thwip as each card lands.

**Status:** 🔶 Done.

- Each dealt card plays a swoosh + small landing thud, staggered 150 ms apart, and the card drops in with a 300 ms `dropIn` animation.

**Open questions**
- Deal spacing: cards currently land 80 units apart in rows of 8 (≈40 mm). Should dealt cards spread to **card-width** spacing (127 units) so they read like a real dealt row?
- Should dealt cards land with a slight random rotation (±2°), like a real deal?
- Is the stagger right — 150 ms per card, or faster (80 ms)?

---

## 5. Table surface that looks like a card table

**Request:** deeper green felt with a felt-ish pattern by default.

**Status:** ✅ Done.

- New default: `#15372a` (deep felt green). Any table saved with the old `#4a5b4f` is migrated automatically on load.
- Surface options: Deep felt green, Blue felt, Red felt, Wood, Dark, Light.
- The felt is layered: lighter centre where the light hits, darker rim, fine cross-hatch weave, and an SVG fractal-noise fuzz. Cards get a warmer, wider shadow so they sit **on** the felt rather than float.

**Open questions**
- Is the fuzz too strong / too subtle at 180px tile size?
- Want a visible table edge (rail), or corner "table cloth" folds?
- Should the surface pick a **texture per material** (wood grain for wood, plain for dark/light)?

---

## 6. Soft ("fuzzy") grid snapping

**Request:** cards snap to an invisible grid, mainly horizontal, also vertical for columns — but not rigidly.

**Status:** 🔶 Done.

- **Snap on/off** button in the table toolbar, persisted per device (`tableSnap`).
- A card snaps to the nearest grid line (pitch = that card's own width/height, anchored at the table origin) **or** to the position of a card already on the table — whichever is nearer.
- It only snaps if the nearest line is within `min(33% of card size, 30 units ≈ 15 mm)`. Move a card a bit further and it stays exactly where you put it.
- A very faint grid guide is drawn when Snap is on (7% opacity).

**Open questions**
- Grid pitch: **each card's own size** (cards tile perfectly) or a fixed poker pitch (63.5 × 88.9 mm) so mixed-size cards still line up to one lattice?
- Is the guide line helpful, or should the grid be *completely* invisible?
- Tolerance: 33% feels right; want it stickier (50%) or looser (20%)?
- Should snapping also straighten rotation to 0°/90° when a card is within a few degrees?
- Should snapping apply **while dragging** (magnetic feel, currently yes) or only when you release?

---

## 7. Extra realism items worth deciding on

| Idea | Why | Decision needed |
|---|---|---|
| Card lift on drag | Real cards lift and cast a bigger shadow | Already partly there (`grabbing` shadow) — deepen it? |
| Cards tilt slightly when dropped on a stack | Stacks are never perfectly square | Add ±1–2° jitter? |
| Sound when a card merges into a stack | That's the "clack" of squaring a pile | Done (place/gather) — want it louder? |
| Sound on draw by dragging off a stack | The peel sound | Done |
| First-sound unlock | Browsers require a user gesture before audio plays; audio starts on your first interaction | Acceptable? |
| Per-table sound setting vs global | Currently global (`tableSound`) | Per table? |
| Deck "cut" — split a stack into two | Real deck handling | Add as a table action? |
| Card thickness illusion for big stacks | A 52-card pile should look thick | Draw more edges when count is high? |

---

## What to test by hand

1. Workshop → Decks → **Choose a back** → cream pattern → Table → tray thumbnail and face-down stack both show the cream back.
2. Workshop → Decks → **Use an image** → Table → thumbnail shows that image.
3. Shuffle a stack: riffle sound + 700 ms jitter.
4. Deal 5: staggered thwips, cards drop in.
5. Drag a card near a card already on the table → it lines up. Drag it further → it stays where you put it.
6. Turn Snap off → nothing snaps.
7. Turn Sound off → silent.

---

## Technical notes

- Sounds are synthesised in `src/features/table/sounds.ts` with the Web Audio API. No asset files, no network, PWA/offline safe.
- Snap logic is pure and unit-tested in `src/test/snap.test.ts` (7 tests).
- Felt texture + animations live in `src/styles/table.css`; animations respect `prefers-reduced-motion`.
