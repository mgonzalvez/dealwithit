import { describe, it, expect } from 'vitest';
import {
  makeBackDesign,
  reshuffleBack,
  generateBackGeometry,
  resolveBack,
  backLabel,
  deriveAccent,
  normalizeHex,
  mixHex,
  BACK_STYLES,
  BACK_COLORS,
  GeneratedBack
} from '../domain/back-designs';
import { generatedBackSchema, deckDefinitionSchema, cardDefinitionSchema } from '../domain/schemas';
import { setGeneratedBack, duplicateDeck, createDeck } from '../domain/deck-operations';
import { CardDefinition, DeckDefinition } from '../domain/models';

const baseCard: CardDefinition = {
  id: 'card-1',
  projectId: 'p1',
  name: 'Test card',
  frontAssetId: 'asset-front',
  frontTransform: { rotationDeg: 0, scale: 1, offsetX: 0, offsetY: 0, fit: 'contain' },
  widthMm: 63.5,
  heightMm: 88.9,
  tags: []
};

describe('generated card backs', () => {
  it('produces a valid design from defaults', () => {
    const design = makeBackDesign({ seed: 42 });
    expect(generatedBackSchema.safeParse(design).success).toBe(true);
    expect(design.pattern).toBe('diamonds'); // seed 42 indexes into BACK_STYLES deterministically
    expect(design.base).toMatch(/^#[0-9a-f]{6}$/);
    expect(design.ink).toMatch(/^#[0-9a-f]{6}$/);
    expect(design.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('normalizes messy color input instead of trusting it', () => {
    expect(normalizeHex('#ABCDEF', '#000000')).toBe('#abcdef');
    expect(normalizeHex('ABCDEF', '#000000')).toBe('#abcdef');
    expect(normalizeHex('not a color', '#123456')).toBe('#123456');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('derives an accent that is distinct from both base and ink', () => {
    const design = makeBackDesign({ seed: 7, base: '#222222', ink: '#ee4444' });
    expect(design.accent).not.toBe(design.base);
    expect(design.accent).not.toBe(design.ink);
  });

  it('renders the same geometry for the same seed and different geometry for a new seed', () => {
    const a = makeBackDesign({ seed: 99, pattern: 'diamonds' });
    const b = makeBackDesign({ seed: 99, pattern: 'diamonds' });
    const c = makeBackDesign({ seed: 100, pattern: 'diamonds' });
    expect(JSON.stringify(generateBackGeometry(a, 300, 420))).toBe(
      JSON.stringify(generateBackGeometry(b, 300, 420))
    );
    expect(JSON.stringify(generateBackGeometry(a, 300, 420))).not.toBe(
      JSON.stringify(generateBackGeometry(c, 300, 420))
    );
  });

  it('every pattern produces geometry inside the card and never empty', () => {
    for (const style of BACK_STYLES) {
      const design = makeBackDesign({ seed: 11, pattern: style.id });
      const shapes = generateBackGeometry(design, 300, 420);
      expect(shapes.length, `pattern ${style.id}`).toBeGreaterThan(0);
      for (const shape of shapes) {
        if (shape.kind === 'rect') {
          expect(shape.x).toBeGreaterThanOrEqual(0);
          expect(shape.y).toBeGreaterThanOrEqual(0);
          expect(shape.x + shape.w).toBeLessThanOrEqual(300 + 0.001);
          expect(shape.y + shape.h).toBeLessThanOrEqual(420 + 0.001);
        }
        if (shape.kind === 'poly') {
          for (let i = 0; i < shape.points.length; i += 2) {
            expect(shape.points[i]).toBeGreaterThanOrEqual(-0.001);
            expect(shape.points[i + 1]).toBeGreaterThanOrEqual(-0.001);
          }
        }
        if (shape.kind === 'circle') {
          expect(shape.r).toBeGreaterThan(0);
        }
      }
    }
  });

  it('pattern arrangement changes with "Shuffle pattern"', () => {
    const design: GeneratedBack = makeBackDesign({ seed: 3, pattern: 'circles' });
    const before = JSON.stringify(generateBackGeometry(design, 300, 420));
    const after = JSON.stringify(generateBackGeometry(reshuffleBack(design), 300, 420));
    expect(before).not.toBe(after);
  });

  it('writes mirrored titles so the back reads either way up', () => {
    const design = makeBackDesign({ seed: 5, pattern: 'plain', title: 'Endless Drive', showTitle: true });
    const texts = generateBackGeometry(design, 300, 420).filter((shape) => shape.kind === 'text');
    expect(texts.length).toBe(2);
    expect(texts.map((t) => t.text)).toEqual(['Endless Drive', 'Endless Drive']);
    expect(texts.map((t) => t.rotateDeg)).toEqual([0, 180]);
  });

  it('omits the title when the name is blank', () => {
    const design = makeBackDesign({ seed: 5, title: '   ', showTitle: true });
    expect(generateBackGeometry(design, 300, 420).some((s) => s.kind === 'text')).toBe(false);
  });

  it('resolves backs with card-over-deck precedence', () => {
    const deck: DeckDefinition = {
      id: 'deck-1',
      projectId: 'p1',
      name: 'Deck',
      entries: [{ id: 'e1', cardDefinitionId: 'card-1', quantity: 2 }],
      defaultBackAssetId: 'asset-deck-back',
      createdAt: 1,
      updatedAt: 1
    };

    expect(resolveBack(baseCard, deck)).toEqual({ kind: 'image', assetId: 'asset-deck-back' });

    const withGeneratedCard = { ...baseCard, backDesign: makeBackDesign({ seed: 1 }) };
    expect(resolveBack(withGeneratedCard, deck).kind).toBe('generated');

    const withImageCard = { ...baseCard, backAssetId: 'asset-card-back', backDesign: makeBackDesign({ seed: 1 }) };
    expect(resolveBack(withImageCard, deck)).toEqual({ kind: 'image', assetId: 'asset-card-back' });

    const deckGenerated = setGeneratedBack(deck, makeBackDesign({ seed: 2 }));
    expect(resolveBack(baseCard, deckGenerated).kind).toBe('generated');
    expect(deckGenerated.defaultBackAssetId).toBeUndefined();

    expect(resolveBack(baseCard).kind).toBe('neutral');
    expect(backLabel({ kind: 'neutral' })).toBe('Neutral back');
    expect(backLabel({ kind: 'generated', design: makeBackDesign({ seed: 0, pattern: 'waves' }) })).toBe('Waves back');
  });

  it('attaches and duplicates a generated back on a deck', () => {
    const deck = createDeck('p1', 'My deck');
    const design = makeBackDesign({ seed: 1234, pattern: 'dots', title: 'My deck', showTitle: true });
    const updated = setGeneratedBack(deck, design);
    expect(deckDefinitionSchema.safeParse(updated).success).toBe(true);

    const copy = duplicateDeck(updated, 'p1');
    expect(copy.defaultBackDesign).toEqual(design);
  });

  it('validates card definitions carrying a generated back', () => {
    const card = { ...baseCard, backDesign: makeBackDesign({ seed: 8 }) };
    expect(cardDefinitionSchema.safeParse(card).success).toBe(true);

    const broken = { ...card, backDesign: { ...card.backDesign, pattern: 'sqiggle' } };
    expect(cardDefinitionSchema.safeParse(broken).success).toBe(false);
  });

  it('offers a small, obvious set of choices', () => {
    expect(BACK_STYLES.length).toBeLessThanOrEqual(8);
    expect(BACK_COLORS.length).toBeLessThanOrEqual(10);
    for (const style of BACK_STYLES) expect(style.label).toBeTruthy();
    for (const color of BACK_COLORS) {
      expect(normalizeHex(color.base, '')).toBe(color.base.toLowerCase());
      expect(normalizeHex(color.ink, '')).toBe(color.ink.toLowerCase());
    }
    void deriveAccent;
  });
});
