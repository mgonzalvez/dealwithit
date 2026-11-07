/**
 * Pure definition of a standard 52-card poker deck.
 *
 * This is what makes Deal With It usable with zero uploads: the app can build
 * a real deck of recognisable cards (A-K in four suits) from nothing but code,
 * so a visitor can shuffle, deal, flip and play within a minute of opening it.
 */

export interface SuitSpec {
  id: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  label: string;
  color: string;
  glyph: string;
}

export interface RankSpec {
  rank: string;
  value: number;
  pipCount: number;
}

export interface StandardCardSpec {
  id: string;
  name: string;
  rank: string;
  suit: SuitSpec;
  /** Normalised pip positions, x/y in 0..1 relative to the card face. */
  pips: Array<{ x: number; y: number }>;
}

export const SUITS: SuitSpec[] = [
  { id: 'hearts', label: 'Hearts', color: '#b3272b', glyph: '\u2665' },
  { id: 'diamonds', label: 'Diamonds', color: '#b3272b', glyph: '\u2666' },
  { id: 'clubs', label: 'Clubs', color: '#1c2531', glyph: '\u2663' },
  { id: 'spades', label: 'Spades', color: '#1c2531', glyph: '\u2660' }
];

export const RANKS: RankSpec[] = [
  { rank: 'A', value: 1, pipCount: 1 },
  { rank: '2', value: 2, pipCount: 2 },
  { rank: '3', value: 3, pipCount: 3 },
  { rank: '4', value: 4, pipCount: 4 },
  { rank: '5', value: 5, pipCount: 5 },
  { rank: '6', value: 6, pipCount: 6 },
  { rank: '7', value: 7, pipCount: 7 },
  { rank: '8', value: 8, pipCount: 8 },
  { rank: '9', value: 9, pipCount: 9 },
  { rank: '10', value: 10, pipCount: 10 },
  { rank: 'J', value: 11, pipCount: 1 },
  { rank: 'Q', value: 12, pipCount: 1 },
  { rank: 'K', value: 13, pipCount: 1 }
];

const CORNER = { x: [0.22, 0.78], y: [0.18, 0.82] };
const MID = { x: [0.22, 0.5, 0.78], y: [0.18, 0.5, 0.82] };

/** Roughly how a real playing card arranges its pips. */
export function pipLayout(rank: string): Array<{ x: number; y: number }> {
  switch (rank) {
    case 'A':
      return [{ x: 0.5, y: 0.5 }];
    case '2':
      return [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }];
    case '3':
      return [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.82 }];
    case '4':
      return [
        { x: CORNER.x[0], y: CORNER.y[0] },
        { x: CORNER.x[1], y: CORNER.y[0] },
        { x: CORNER.x[0], y: CORNER.y[1] },
        { x: CORNER.x[1], y: CORNER.y[1] }
      ];
    case '5':
      return [
        { x: CORNER.x[0], y: CORNER.y[0] },
        { x: CORNER.x[1], y: CORNER.y[0] },
        { x: 0.5, y: 0.5 },
        { x: CORNER.x[0], y: CORNER.y[1] },
        { x: CORNER.x[1], y: CORNER.y[1] }
      ];
    case '6':
      return [
        { x: CORNER.x[0], y: 0.18 },
        { x: CORNER.x[1], y: 0.18 },
        { x: CORNER.x[0], y: 0.5 },
        { x: CORNER.x[1], y: 0.5 },
        { x: CORNER.x[0], y: 0.82 },
        { x: CORNER.x[1], y: 0.82 }
      ];
    case '7':
      return [
        { x: CORNER.x[0], y: 0.18 },
        { x: 0.5, y: 0.34 },
        { x: CORNER.x[1], y: 0.18 },
        { x: CORNER.x[0], y: 0.5 },
        { x: CORNER.x[1], y: 0.5 },
        { x: CORNER.x[0], y: 0.82 },
        { x: CORNER.x[1], y: 0.82 }
      ];
    case '8':
      return [
        { x: CORNER.x[0], y: 0.18 },
        { x: 0.5, y: 0.34 },
        { x: CORNER.x[1], y: 0.18 },
        { x: CORNER.x[0], y: 0.5 },
        { x: CORNER.x[1], y: 0.5 },
        { x: 0.5, y: 0.66 },
        { x: CORNER.x[0], y: 0.82 },
        { x: CORNER.x[1], y: 0.82 }
      ];
    case '9':
      return MID.x.flatMap((x) => MID.y.map((y) => ({ x, y })));
    case '10':
      return [
        { x: CORNER.x[0], y: 0.16 },
        { x: CORNER.x[1], y: 0.16 },
        { x: 0.5, y: 0.32 },
        { x: CORNER.x[0], y: 0.42 },
        { x: CORNER.x[1], y: 0.42 },
        { x: CORNER.x[0], y: 0.58 },
        { x: CORNER.x[1], y: 0.58 },
        { x: 0.5, y: 0.68 },
        { x: CORNER.x[0], y: 0.84 },
        { x: CORNER.x[1], y: 0.84 }
      ];
    default:
      // Face cards: one large emblem.
      return [{ x: 0.5, y: 0.5 }];
  }
}

export function standardCardSpecs(): StandardCardSpec[] {
  const cards: StandardCardSpec[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${suit.id}-${rank.rank}`,
        name: `${rank.rank} of ${suit.label}`,
        rank: rank.rank,
        suit,
        pips: pipLayout(rank.rank)
      });
    }
  }
  return cards;
}
