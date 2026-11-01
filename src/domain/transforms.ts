import { ImageTransform } from './models';

export const DEFAULT_TRANSFORM: ImageTransform = {
  rotationDeg: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  fit: 'contain'
};

/** Normalize any degree value into the 0/90/180/270 card rotation set. */
export function normalizeCardRotation(deg: number): 0 | 90 | 180 | 270 {
  const normalized = ((deg % 360) + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

/** Rotate a transform by 90° steps, non-destructively. */
export function rotateTransform(transform: ImageTransform, deg: 90 | -90): ImageTransform {
  const next = normalizeCardRotation(transform.rotationDeg + deg);
  return { ...transform, rotationDeg: next };
}

/** Round-trip check: applying then comparing preserves presentation values. */
export function transformEquals(a: ImageTransform, b: ImageTransform): boolean {
  return (
    a.rotationDeg === b.rotationDeg &&
    a.scale === b.scale &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.fit === b.fit
  );
}

/** Common physical card size presets (mm). */
export const CARD_SIZE_PRESETS = {
  poker: { widthMm: 63.5, heightMm: 88.9 },
  bridge: { widthMm: 57.2, heightMm: 88.9 },
  square: { widthMm: 63.5, heightMm: 63.5 },
  mini: { widthMm: 44.5, heightMm: 68 }
};
