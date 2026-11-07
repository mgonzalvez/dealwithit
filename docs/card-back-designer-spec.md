# Card Back Designer — Feature Spec

**Feature:** generate a card back instead of uploading one — a playing-card style pattern, or a classic back with the game name printed on it. Six styles, eight colours, three clicks.

**Implemented:** 2026-11-07, reworked 2026-11-07 (v2) into a single picker that also covers uploaded-image backs and "no back".
**Files:** `src/domain/back-designs.ts` (pattern math), `src/features/backdesign/CardBackDesigner.tsx` (picker), `src/features/backdesign/BackChip.tsx`, `src/features/workshop/cardRenderer.ts` (drawing), `src/app/tips.ts` + `src/components/Coach.tsx` (inline coaching).

---

## 1. What the user sees

There is **one button for backs: "Choose a back"** — on the deck panel, on the Cards tab toolbar (for selected cards), on each card tile, and in the card editor. No dropdowns, no separate "generate" vs "assign" paths.

The picker opens with a live preview on the left and three tabs on the right:

| Tab | What it does |
|---|---|
| **Generate a pattern** | 1. Pick a pattern (6 live thumbnails) · 2. Pick a colour (8 curated + custom background/pattern pickers) · 3. Optionally put the game name on it |
| **Use an image** | Grid of every image already imported in the project, with thumbnails |
| **No back** | Clears the back; cards show the neutral grey back |

Extras: **Surprise me** (random style + colour) and **Shuffle the pattern** (keep the colours, redraw the pattern). A large preview updates on every click, and shows the image thumbnail when an image is chosen.

Apply targets, depending on where you opened it:
- **Apply to this deck** — every card in the deck uses it.
- **Apply to selected cards** — from the Cards tab toolbar.
- **Apply to this card** — from a card tile or the card editor.

A small live chip shows the deck's current back.

### Coaching tips (v2)

Each decision point carries a one-line `Coach` hint (e.g. "Diamonds is the classic playing-card look…", "This back only affects this card. If you do not set one, the card uses the back of the deck it belongs to."). The **Tips on/off** button in the header toggles them globally; the choice is persisted in the settings store (`getSetting('tips')`) so a confident user can switch them off for good. The full guided Tour remains available from the Library.

## 2. Data model

```ts
interface GeneratedBack {
  seed: number;            // integer — makes the pattern reproducible
  pattern: 'diamonds' | 'lattice' | 'circles' | 'waves' | 'dots' | 'plain';
  base: string;            // #rrggbb background
  ink: string;             // #rrggbb pattern colour
  accent: string;          // derived from ink + base
  title: string;           // '' = no name printed
  showTitle: boolean;
  border: number;          // 0..1 frame thickness
}
```

Stored as `CardDefinition.backDesign` and `DeckDefinition.defaultBackDesign`. A generated back and an uploaded back image are **mutually exclusive** — choosing one clears the other.

No new IndexedDB table or index. The design is plain JSON, so it is tiny: it travels in project exports and never touches the image blobs.

## 3. Precedence

`resolveBack(card, deck)` is the single source of truth:

```
card.backAssetId → card.backDesign → deck.defaultBackAssetId → deck.defaultBackDesign → generic back
```

A card's own back always beats the deck default. With neither, `drawNeutralBack()` renders a proper generic playing-card back (dark blue lattice, double frame, centre emblem) instead of a flat grey rectangle.

## 4. Rendering

Pattern geometry is pure and testable:

```
generateBackGeometry(design, widthPx, heightPx) → Shape[]
drawGeneratedBack(ctx, design, width, height)   // draws base + shapes + frame
```

- The PRNG is mulberry32 seeded from `design.seed`; **no** `Math.random()` in the render path, so the same JSON always looks identical on any device.
- Every shape is generated inside the card rectangle.
- The printed name appears **twice, mirrored** (top and bottom), so it reads correctly whichever way the card is face-down. If the name is long, the type shrinks to fit rather than being cut off.

## 5. Validation

`generatedBackSchema` (Zod) checks the pattern enum, non-negative integer seed, `#rrggbb` colours, title length ≤ 60, and border 0–1. Malformed designs are rejected on import rather than silently corrupting a project.

## 6. Tutorial

The tour step **"Choose a card back"** sits between "Pair fronts with backs" and "Assemble a deck", and QuickStart step 4 mentions generated backs. The demo deck ships with a generated diamond back so the feature is visible immediately, and QuickStart step 1 offers **Play a standard 52-card deck** for visitors who have nothing to upload.

## 7. Backs on the Table

A face-down stack shows **the back of the deck it came from**. `TableObject.sourceDeckId` identifies the deck, and rendered faces are cached per `card + face + deck` (previously the cache was keyed by card alone and used the first deck containing that card, which is why a cream back chosen in the Workshop could still appear green on the table).

The tray shows a true thumbnail of each deck's back — generated pattern or uploaded image — with a plain-language label: "Classic diamonds back", "Image back", "Generic back".

See `docs/table-realism-spec.md` for how cards shuffle, deal, snap and sound on the felt.

## 8. Verification

- **105 unit tests** (12 files), including 12 in `src/test/back-design.test.ts`: determinism, geometry bounds, mirrored titles, precedence, schema validation, deck duplication carrying the design.
- Visual check: all six styles in three colours, the generic back and standard card art rendered through headless Chrome.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass.
