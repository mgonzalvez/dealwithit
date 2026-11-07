import { describe, it, expect } from 'vitest';
import { softSnap, snapRotation, snapTolerance } from '../features/table/snap';
import { playTableSound, setSoundMuted } from '../features/table/sounds';

const PITCH = 127; // poker card, 63.5 mm at 2 units per mm

describe('fuzzy grid snapping', () => {
  it('pulls a card to the grid when it is already close', () => {
    expect(softSnap(120, PITCH, snapTolerance(PITCH), [])).toBe(127);
    expect(softSnap(133, PITCH, snapTolerance(PITCH), [])).toBe(127);
  });

  it('leaves a card alone when it is clearly off-grid', () => {
    const value = 60; // halfway between 0 and 127
    expect(softSnap(value, PITCH, snapTolerance(PITCH), [])).toBe(value);
  });

  it('prefers the nearest line, including negative coordinates', () => {
    expect(softSnap(-124, PITCH, snapTolerance(PITCH), [])).toBe(-127);
  });

  it('aligns with cards already on the table, not just the arithmetic grid', () => {
    // 300 is far from any 127 multiple (nearest is 254, 46 away) but a card
    // sits at 296, so the dragged card lines up with it.
    expect(softSnap(300, PITCH, snapTolerance(PITCH), [296])).toBe(296);
  });

  it('tolerance scales with card size but never gets aggressive', () => {
    expect(snapTolerance(127)).toBe(20);
    expect(snapTolerance(60)).toBeCloseTo(12);
    expect(softSnap(10, 127, 20, [])).toBe(0);
    expect(softSnap(45, 127, 20, [])).toBe(45);
  });

  it('is looser than it used to be: 25 units off the line stays free', () => {
    expect(softSnap(25, 127, snapTolerance(127), [])).toBe(25);
  });

  it('straightens cards that are nearly square, leaves angled ones alone', () => {
    expect(snapRotation(2)).toBe(0);
    expect(snapRotation(-1.5)).toBe(0);
    expect(snapRotation(88)).toBe(90);
    expect(snapRotation(30)).toBe(30);
    expect(snapRotation(95)).toBe(95);
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
