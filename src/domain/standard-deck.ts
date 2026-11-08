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
  pips: Array<{ x: number; y: number; flip: boolean }>;
}

export const SUITS: SuitSpec[] = [
  { id: 'hearts', label: 'Hearts', color: '#a8262b', glyph: '\u2665' },
  { id: 'diamonds', label: 'Diamonds', color: '#a8262b', glyph: '\u2666' },
  { id: 'clubs', label: 'Clubs', color: '#1b2430', glyph: '\u2663' },
  { id: 'spades', label: 'Spades', color: '#1b2430', glyph: '\u2660' }
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

const C = { left: 0.26, mid: 0.5, right: 0.74 };
const R = { top: 0.19, upperMid: 0.35, mid: 0.5, lowerMid: 0.65, bottom: 0.81 };

/**
 * How a real card arranges its pips: two columns plus a centre column, with the
 * lower half turned upside down so the card reads the same whichever way up
 * you hold it.
 */
export function pipLayout(rank: string): Array<{ x: number; y: number; flip: boolean }> {
  const column = (y: number, flip: boolean) => [
    { x: C.left, y, flip },
    { x: C.right, y, flip }
  ];
  const corners = [
    { x: C.left, y: R.top, flip: false },
    { x: C.right, y: R.top, flip: false },
    { x: C.left, y: R.bottom, flip: true },
    { x: C.right, y: R.bottom, flip: true }
  ];

  switch (rank) {
    case 'A':
      return [{ x: C.mid, y: C.mid, flip: false }];
    case '2':
      return [{ x: C.mid, y: R.top, flip: false }, { x: C.mid, y: R.bottom, flip: true }];
    case '3':
      return [
        { x: C.mid, y: R.top, flip: false },
        { x: C.mid, y: C.mid, flip: false },
        { x: C.mid, y: R.bottom, flip: true }
      ];
    case '4':
      return corners;
    case '5':
      return [...corners, { x: C.mid, y: C.mid, flip: false }];
    case '6':
      return [...column(R.top, false), ...column(C.mid, false), ...column(R.bottom, true)];
    case '7':
      return [
        ...column(R.top, false),
        { x: C.mid, y: R.upperMid, flip: false },
        ...column(C.mid, false),
        ...column(R.bottom, true)
      ];
    case '8':
      return [
        ...column(R.top, false),
        { x: C.mid, y: R.upperMid, flip: false },
        { x: C.mid, y: R.lowerMid, flip: true },
        ...column(C.mid, false),
        ...column(R.bottom, true)
      ];
    case '9':
      return [
        ...column(R.top, false),
        ...column(R.upperMid, false),
        { x: C.mid, y: C.mid, flip: false },
        ...column(R.lowerMid, true),
        ...column(R.bottom, true)
      ];
    case '10':
      return [
        ...column(R.top, false),
        { x: C.mid, y: R.upperMid, flip: false },
        ...column(R.upperMid, false),
        ...column(R.lowerMid, true),
        { x: C.mid, y: R.lowerMid, flip: true },
        ...column(R.bottom, true)
      ];
    default:
      // Face cards: one large emblem.
      return [{ x: C.mid, y: C.mid, flip: false }];
  }
}

export function standardCardSpecs(): StandardCardSpec[] {
  const cards: StandardCardSpec[] = [];
  // Rank-major order (A♥ A♦ A♣ A♠ 2♥ 2♦ ...) so a freshly dealt handful is a
  // mix of suits rather than thirteen spades in a row.
  for (const rank of RANKS) {
    for (const suit of SUITS) {
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
