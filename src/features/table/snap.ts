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
 * How sticky the grid should feel: about a third of a card, capped at 45 table
 * units (~22 mm). Inside that window the card is pulled onto the line; outside
 * it stays exactly where you put it.
 */
export function snapTolerance(cardSize: number): number {
  return Math.min(cardSize * 0.35, 45);
}

/**
 * Do two rectangles overlap enough to count as "the card is on the pile"?
 * A centre-to-centre offset smaller than half the card is not enough: a card
 * dropped next to a pile, or peeled only a few millimetres off it, should stay
 * separate. The fraction of the two cards' overlapping area decides it.
 */
export function stacksOverlap(
  a: { w: number; h: number },
  b: { w: number; h: number },
  dx: number,
  dy: number,
  minimumFraction = 0.6
): boolean {
  const overlapW = Math.min(a.w, b.w) - Math.abs(dx);
  const overlapH = Math.min(a.h, b.h) - Math.abs(dy);
  if (overlapW <= 0 || overlapH <= 0) return false;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return (overlapW * overlapH) / smaller >= minimumFraction;
}

/**
 * Straighten a card that is within `within` degrees of square. Dealt cards land
 * 1-2 degrees off; this is the squaring-up tap you give them.
 */
export function snapRotation(deg: number, within = 6): number {
  const nearest = Math.round(deg / 90) * 90 + 0;
  return Math.abs(deg - nearest) <= within ? nearest : deg;
}

/**
 * Anchor points contributed by the cards already on the table: each card's
 * centre, its edges, and the positions one card-width-plus-gap away, so a card
 * dropped next to another lines up beside it rather than half a card off.
 */
export function neighbourAnchors(
  neighbours: Array<{ centre: number; span: number }>,
  gap = 0
): number[] {
  const points = neighbours.flatMap((n) => [
    n.centre,
    n.centre - n.span,
    n.centre + n.span,
    n.centre - (n.span + gap),
    n.centre + (n.span + gap)
  ]);
  return Array.from(new Set(points.map((value) => Math.round(value * 100) / 100)));
}

/**
 * How much space the snap grid leaves between cards. "Touching" is too tight,
 * a whole card width is too loose — the comfortable middle is a fraction of the
 * card you are holding, so the gap scales with card size.
 */
export const SPACING = {
  tight: 0.06,
  normal: 0.18,
  wide: 0.35
} as const;

export type SpacingKey = keyof typeof SPACING;

export function spacingGap(cardSize: number, spacing: SpacingKey = 'normal'): number {
  return Math.max(4, Math.min(60, Math.round(cardSize * SPACING[spacing])));
}
