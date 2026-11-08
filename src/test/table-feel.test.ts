import { describe, it, expect } from 'vitest';
import { clampZoom, MAX_ZOOM, MIN_ZOOM, pinchZoom, fingerDistance } from '../features/table/pinch';
import { spacingGap, SPACING, type SpacingKey } from '../features/table/snap';

const CARD = 127; // poker card, 63.5 mm at 2 units per mm

describe('pinch to zoom', () => {
  it('scales by the ratio of finger distance', () => {
    expect(pinchZoom(1, 100, 200)).toBe(2);
    expect(pinchZoom(2, 200, 100)).toBe(1);
  });

  it('holds the zoom when the fingers do not move', () => {
    expect(pinchZoom(1.4, 120, 120)).toBe(1.4);
  });

  it('never goes past the zoom limits', () => {
    expect(pinchZoom(1, 10, 10000)).toBe(MAX_ZOOM);
    expect(pinchZoom(1, 10000, 10)).toBe(MIN_ZOOM);
  });

  it('survives two fingers on the same pixel', () => {
    expect(pinchZoom(1.25, 0, 0)).toBe(1.25);
  });

  it('clamps', () => {
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('measures finger distance diagonally too', () => {
    expect(fingerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('spacing between snapped cards', () => {
  it('tight is a hair, wide is a hand, normal is in between', () => {
    const tight = spacingGap(CARD, 'tight');
    const normal = spacingGap(CARD, 'normal');
    const wide = spacingGap(CARD, 'wide');
    expect(tight).toBe(8);
    expect(normal).toBe(23);
    expect(wide).toBe(44);
    expect(tight < normal && normal < wide).toBe(true);
    // Normal should feel like a card's worth of breathing room, not a gap wide
    // enough to lose a card in, and not so tight the edges touch.
    expect(normal / CARD).toBeGreaterThan(0.1);
    expect(normal / CARD).toBeLessThan(0.3);
  });

  it('scales with the card, but never becomes useless', () => {
    expect(spacingGap(250, 'wide')).toBe(60); // capped
    expect(spacingGap(20, 'tight')).toBe(4); // floored
    expect(spacingGap(127)).toBe(23); // defaults to normal
  });

  it('keeps the three settings distinct for small cards too', () => {
    const gaps = (Object.keys(SPACING) as SpacingKey[]).map((key) => spacingGap(80, key));
    expect(new Set(gaps).size).toBe(3);
  });
});
