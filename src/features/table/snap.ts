/**
 * "Fuzzy" grid snapping.
 *
 * Cards are pulled toward the grid line — and toward the columns/rows of
 * cards already on the table — only when they are already close to it. Move a
 * card a little further off and it stays exactly where you put it. That is the
 * feeling of cards squaring up on a real table without being glued to a lattice.
 */

export interface SnapAxes {
  x: number;
  y: number;
}

function nearestCandidate(value: number, candidates: number[]): { value: number; delta: number } {
  let best = value;
  let bestDelta = Infinity;
  for (const candidate of candidates) {
    const delta = Math.abs(candidate - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }
  return { value: best, delta: bestDelta };
}

/**
 * Snap `value` to the nearest grid line (every `pitch` units, anchored at 0)
 * or to one of the `anchors` (other cards' positions), but only if the nearest
 * one is within `tolerance`. Otherwise return the value untouched.
 */
export function softSnap(
  value: number,
  pitch: number,
  tolerance: number,
  anchors: number[]
): number {
  if (pitch <= 0) return value;
  const candidates = [Math.round(value / pitch) * pitch, ...anchors];
  const nearest = nearestCandidate(value, candidates);
  return nearest.delta <= tolerance ? nearest.value : value;
}

/**
 * How sticky the grid should feel: about a third of a card, never more than
 * 30 table units (~15 mm).
 */
export function snapTolerance(cardSize: number): number {
  return Math.min(cardSize * 0.33, 30);
}
