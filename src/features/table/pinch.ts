/**
 * Pinch-zoom maths, kept separate from the DOM so it can be tested and tuned
 * without a browser. Two fingers start a pinch `a` and `b` pixels apart; the
 * pack scales by the ratio of how far they have travelled.
 */

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function pinchZoom(startZoom: number, startDistance: number, currentDistance: number): number {
  if (startDistance <= 0) return startZoom;
  return clampZoom(startZoom * (currentDistance / startDistance));
}

/** Distance between two fingers. */
export function fingerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
