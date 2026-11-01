import { describe, it, expect } from 'vitest';
import { DEFAULT_TRANSFORM, normalizeCardRotation, rotateTransform, transformEquals } from '../domain/transforms';

describe('transforms', () => {
  it('normalizes rotations into the 0/90/180/270 set', () => {
    expect(normalizeCardRotation(360)).toBe(0);
    expect(normalizeCardRotation(-90)).toBe(270);
    expect(normalizeCardRotation(450)).toBe(90);
  });

  it('90-degree rotations round-trip', () => {
    let t = DEFAULT_TRANSFORM;
    t = rotateTransform(t, 90);
    t = rotateTransform(t, 90);
    t = rotateTransform(t, 90);
    t = rotateTransform(t, 90);
    expect(transformEquals(t, DEFAULT_TRANSFORM)).toBe(true);
  });
});
