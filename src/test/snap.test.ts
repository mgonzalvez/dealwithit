import { describe, it, expect } from 'vitest';
import { neighbourAnchors, softSnap, snapRotation, snapTolerance, stacksOverlap } from '../features/table/snap';
import { playTableSound, setSoundMuted } from '../features/table/sounds';

const PITCH = 127; // poker card, 63.5 mm at 2 units per mm

describe('fuzzy grid snapping', () => {
  it('pulls a card to the grid when it is already close', () => {
    expect(softSnap(120, PITCH, snapTolerance(PITCH), [])).toBe(127);
    expect(softSnap(133, PITCH, snapTolerance(PITCH), [])).toBe(127);
  });

  it('is magnetic across a third of a card', () => {
    // 90 is 37 units from the 127 line — a real player would expect the card
    // to jump onto the line.
    expect(softSnap(90, PITCH, snapTolerance(PITCH), [])).toBe(127);
  });

  it('leaves a card alone when it is clearly off-grid', () => {
    const value = 62; // roughly halfway between 0 and 127
    expect(softSnap(value, PITCH, snapTolerance(PITCH), [])).toBe(value);
    expect(softSnap(180, PITCH, snapTolerance(PITCH), [])).toBe(180);
  });

  it('prefers the nearest line, including negative coordinates', () => {
    expect(softSnap(-124, PITCH, snapTolerance(PITCH), [])).toBe(-127);
  });

  it('aligns with cards already on the table, not just the arithmetic grid', () => {
    // 300 is far from any 127 multiple (nearest is 254) but a card sits at 296,
    // so the dragged card lines up with it.
    expect(softSnap(300, PITCH, snapTolerance(PITCH), [296])).toBe(296);
  });

  it('lines cards up edge-to-edge as well as centre-to-centre', () => {
    const anchors = neighbourAnchors([{ centre: 254, span: 127 }]);
    expect(anchors).toEqual([254, 127, 381]);
    // A card dropped at 385 is 4 units from the edge of the card at 254.
    expect(softSnap(385, PITCH, snapTolerance(PITCH), anchors)).toBe(381);
  });

  it('offers a gap-sized anchor so neighbours do not end up flush', () => {
    // Neighbour at 254, 127 wide, 18-unit gap: the natural next slot is
    // 254 + 127 + 18 = 399 — not 381 (touching) and not 508 (a whole card of
    // dead space). That is the "in between" the plain grid never offered.
    const anchors = neighbourAnchors([{ centre: 254, span: 127 }], 18);
    expect(anchors).toContain(399);
    expect(anchors).toContain(109);
    expect(softSnap(393, 145, snapTolerance(PITCH), anchors)).toBe(399);
  });

  it('does not repeat anchors when the gap is zero', () => {
    expect(neighbourAnchors([{ centre: 254, span: 127 }], 0)).toEqual([254, 127, 381]);
  });

  it('only stacks a card that is really on the pile', () => {
    const card = { w: 127, h: 178 };
    // Dead centre: obviously a pile.
    expect(stacksOverlap(card, card, 0, 0)).toBe(true);
    // A card laid beside the pile, centre half a card away: not a pile.
    expect(stacksOverlap(card, card, 63, 0)).toBe(false);
    // A card lifted off the top of the deck it just came from needs to be back
    // on it almost exactly before it re-joins (the 0.85 rule).
    expect(stacksOverlap(card, card, 0, 60, 0.85)).toBe(false);
    expect(stacksOverlap(card, card, 0, 10, 0.85)).toBe(true);
    // A card dropped squarely on top of a different deck stacks.
    expect(stacksOverlap(card, card, 20, 25)).toBe(true);
    // No overlap at all.
    expect(stacksOverlap(card, card, 200, 0)).toBe(false);
  });

  it('tolerance scales with card size but never gets aggressive', () => {
    expect(snapTolerance(127)).toBeCloseTo(44.45, 1);
    expect(snapTolerance(60)).toBeCloseTo(21, 0);
    expect(snapTolerance(400)).toBe(45); // capped
    expect(softSnap(10, 127, 20, [])).toBe(0);
    expect(softSnap(45, 127, 20, [])).toBe(45);
  });

  it('straightens cards that are nearly square, leaves angled ones alone', () => {
    expect(snapRotation(2)).toBe(0);
    expect(snapRotation(-1.5)).toBe(0);
    expect(snapRotation(88)).toBe(90);
    expect(snapRotation(95)).toBe(90);
    expect(snapRotation(30)).toBe(30);
    expect(snapRotation(97)).toBe(97);
  });

  it('is a no-op for degenerate sizes', () => {
    expect(softSnap(17, 0, 30, [])).toBe(17);
  });
});

describe('table sounds', () => {
  it('never throws when there is no audio device (Node/test environment)', () => {
    setSoundMuted(false);
    for (const kind of ['flip', 'shuffle', 'deal', 'draw', 'place', 'gather'] as const) {
      expect(() => playTableSound(kind)).not.toThrow();
    }
  });
});
