# Card Back Designer — Feature Spec

**Feature:** generate a card back instead of uploading one — a playing-card style pattern, or a classic back with the game name printed on it. Six styles, eight colours, three clicks.

**Implemented:** 2026-11-07.
**Files:** `src/domain/back-designs.ts` (pattern math), `src/features/backdesign/CardBackDesigner.tsx` (wizard), `src/features/backdesign/BackChip.tsx`, `src/features/workshop/cardRenderer.ts` (drawing).

---

## 1. What the user sees

In **Workshop › Decks**, press **Generate a back**. A three-step wizard opens:

1. **Style** — six thumbnails rendered live in the colours you've chosen:
   Classic diamonds · Crosshatch · Ring pattern · Waves · Polka dots · Solid colour
2. **Colour** — eight curated colours (Crimson, Midnight, Forest, Cream, Teal, Violet, Slate, Mustard), or two custom pickers for background and pattern.
3. **Name** — type the game name (pre-filled with the project name) or leave it blank for a pattern-only back.

Extras: **Surprise me** (random style + colour) and **Shuffle pattern** (keep the colours, redraw the pattern). A large preview updates on every click.

Apply targets, depending on where you opened it:
- **Apply to this deck** — every card in the deck uses it.
- **Apply to selected cards** — from the Cards tab toolbar.
- **Apply to this card** — from the card editor.

A small thumbnail chip shows the deck's current generated back.

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
card.backAssetId → card.backDesign → deck.defaultBackAssetId → deck.defaultBackDesign → neutral fallback
```

A card's own back always beats the deck default.

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

A new tour step — **"Design your own card back"** — sits between "Pair fronts with backs" and "Assemble a deck", and QuickStart step 3 mentions generated backs. The demo deck ships with a generated diamond back so the feature is visible immediately.

## 7. Verification

- **86 unit tests** (10 files), including 12 new ones in `src/test/back-design.test.ts`: determinism, geometry bounds, mirrored titles, precedence, schema validation, deck duplication carrying the design.
- Visual check: rendered all six styles in three colours through headless Chrome.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass.
