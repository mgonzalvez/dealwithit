import { describe, it, expect } from 'vitest';
import { RANKS, SUITS, pipLayout, standardCardSpecs } from '../domain/standard-deck';

describe('standard 52-card deck', () => {
  const specs = standardCardSpecs();

  it('has exactly 52 unique cards', () => {
    expect(specs.length).toBe(52);
    expect(new Set(specs.map((card) => card.id)).size).toBe(52);
  });

  it('has four suits with thirteen ranks each', () => {
    expect(SUITS.length).toBe(4);
    for (const suit of SUITS) {
      expect(specs.filter((card) => card.suit.id === suit.id).length).toBe(13);
    }
  });

  it('names cards like a real deck', () => {
    const names = specs.map((card) => card.name);
    expect(names).toContain('A of Spades');
    expect(names).toContain('10 of Hearts');
    expect(names).toContain('K of Clubs');
  });

  it('colours hearts and diamonds red, clubs and spades dark', () => {
    for (const card of specs) {
      const red = card.suit.id === 'hearts' || card.suit.id === 'diamonds';
      expect(card.suit.color).toBe(red ? '#a8262b' : '#1b2430');
    }
  });

  it('orders the pack so dealing a handful mixes suits', () => {
    // Rank-major order means the top of a freshly launched pack is K♠, K♣,
    // K♦, K♥, Q♠ ... rather than thirteen spades in a row.
    const topFour = specs.slice(-4).map((card) => card.suit.id);
    expect(new Set(topFour).size).toBe(4);
  });

  it('arranges pips in the standard card pattern', () => {
    const positions = (rank: string) => new Set(pipLayout(rank).map((p) => `${p.x}:${p.y}`));
    expect(positions('6').size).toBe(6);
    expect(positions('10').size).toBe(10);
    // The lower half of a real card is turned upside down.
    const bottom = pipLayout('4').filter((p) => p.y > 0.5);
    expect(bottom.length).toBe(2);
    expect(bottom.every((p) => p.flip)).toBe(true);
    expect(pipLayout('4').filter((p) => p.y < 0.5).every((p) => !p.flip)).toBe(true);
  });

  it('draws the right number of pips for each rank', () => {
    for (const rank of RANKS) {
      expect(pipLayout(rank.rank).length).toBe(rank.pipCount);
    }
  });

  it('keeps every pip inside the card', () => {
    for (const pip of specs.flatMap((card) => card.pips)) {
      expect(pip.x).toBeGreaterThanOrEqual(0);
      expect(pip.x).toBeLessThanOrEqual(1);
      expect(pip.y).toBeGreaterThanOrEqual(0);
      expect(pip.y).toBeLessThanOrEqual(1);
    }
  });

  it('does not place two pips on the same spot', () => {
    for (const card of specs) {
      const spots = new Set(card.pips.map((pip) => `${pip.x}:${pip.y}`));
      expect(spots.size).toBe(card.pips.length);
    }
  });
});
