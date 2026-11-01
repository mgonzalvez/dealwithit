import { describe, it, expect } from 'vitest';
import {
  addEntryToDeck,
  createDeck,
  deckCardCount,
  dealN,
  duplicateDeck,
  drawTop,
  incrementEntry,
  moveEntry,
  randomInt,
  removeEntry,
  setEntryQuantity,
  shuffleInstances
} from '../domain/deck-operations';
import { CardInstance } from '../domain/models';

function instances(n: number): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({
    instanceId: `inst-${i}`,
    cardDefinitionId: 'card-a',
    face: 'back' as const,
    rotationDeg: 0
  }));
}

describe('randomInt', () => {
  it('stays within range', () => {
    for (let i = 0; i < 200; i++) {
      const v = randomInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
    expect(randomInt(1)).toBe(0);
  });
});

describe('shuffleInstances', () => {
  it('preserves count and identity (multiset), returns a new array', () => {
    const input = instances(50);
    const shuffled = shuffleInstances(input);
    expect(shuffled.length).toBe(input.length);
    expect(shuffled).not.toBe(input);
    const idsA = input.map((i) => i.instanceId).sort();
    const idsB = shuffled.map((i) => i.instanceId).sort();
    expect(idsA).toEqual(idsB);
  });

  it('does not mutate the input', () => {
    const input = instances(20);
    const snapshot = [...input];
    shuffleInstances(input);
    expect(input).toEqual(snapshot);
  });
});

describe('drawTop / dealN', () => {
  it('draws the top (last) instance', () => {
    const input = instances(5);
    const { drawn, remaining } = drawTop(input);
    expect(drawn?.instanceId).toBe('inst-4');
    expect(remaining.map((i) => i.instanceId)).toEqual(['inst-0', 'inst-1', 'inst-2', 'inst-3']);
  });

  it('returns null on empty stack', () => {
    const { drawn, remaining } = drawTop([]);
    expect(drawn).toBeNull();
    expect(remaining).toEqual([]);
  });

  it('deals N cards from the top', () => {
    const { dealt, remaining } = dealN(instances(10), 3);
    // Dealt cards keep bottom-to-top order (top = last), consistent with stacks.
    expect(dealt.map((i) => i.instanceId)).toEqual(['inst-7', 'inst-8', 'inst-9']);
    expect(remaining.length).toBe(7);
  });
});

describe('deck recipes', () => {
  it('addEntryToDeck merges quantities for the same card', () => {
    const deck = createDeck('project-1', 'Main Deck');
    let d = addEntryToDeck(deck, 'card-a', 2);
    d = addEntryToDeck(d, 'card-a', 3);
    expect(d.entries.length).toBe(1);
    expect(deckCardCount(d)).toBe(5);
  });

  it('incrementEntry duplicates without touching image assets', () => {
    const deck = createDeck('project-1', 'Main Deck');
    const d = addEntryToDeck(deck, 'card-a', 1);
    const incremented = incrementEntry(d, d.entries[0].id, 2);
    expect(deckCardCount(incremented)).toBe(3);
    expect(incremented.entries[0].id).toBe(d.entries[0].id);
  });

  it('moveEntry reorders entries', () => {
    const deck = createDeck('p', 'Main');
    let d = addEntryToDeck(deck, 'a', 1);
    d = addEntryToDeck(d, 'b', 1);
    d = addEntryToDeck(d, 'c', 1);
    const ids = d.entries.map((e) => e.cardDefinitionId);
    expect(ids).toEqual(['a', 'b', 'c']);
    const targetId = d.entries[1].id;
    const moved = moveEntry(d, targetId, -1);
    expect(moved.entries.map((e) => e.cardDefinitionId)).toEqual(['b', 'a', 'c']);
    const noOp = moveEntry(moved, moved.entries[0].id, -1);
    expect(noOp.entries.map((e) => e.cardDefinitionId)).toEqual(['b', 'a', 'c']);
  });

  it('setEntryQuantity clamps to at least 1', () => {
    const deck = createDeck('p', 'Main');
    const d = addEntryToDeck(deck, 'a', 3);
    expect(deckCardCount(setEntryQuantity(d, d.entries[0].id, 0))).toBe(1);
    expect(deckCardCount(setEntryQuantity(d, d.entries[0].id, 7))).toBe(7);
  });

  it('removeEntry drops the entry only', () => {
    const deck = createDeck('p', 'Main');
    let d = addEntryToDeck(deck, 'a', 2);
    d = addEntryToDeck(d, 'b', 3);
    const removed = removeEntry(d, d.entries[0].id);
    expect(removed.entries.length).toBe(1);
    expect(deckCardCount(removed)).toBe(3);
  });

  it('duplicateDeck copies the recipe with fresh IDs and no blob duplication', () => {
    const deck = createDeck('p', 'Main');
    const d = addEntryToDeck(deck, 'a', 4);
    const copy = duplicateDeck(d, 'p');
    expect(copy.id).not.toBe(d.id);
    expect(copy.name).toBe('Main (copy)');
    expect(copy.entries.length).toBe(1);
    expect(copy.entries[0].id).not.toBe(d.entries[0].id);
    expect(copy.entries[0].cardDefinitionId).toBe('a');
    expect(copy.entries[0].quantity).toBe(4);
  });

  it('table operations never mutate the deck recipe', () => {
    const deck = createDeck('project-1', 'Main Deck');
    const d = addEntryToDeck(deck, 'card-a', 4);
    const snapshot = structuredClone(d);
    const launched = d.entries.flatMap((e) =>
      Array.from({ length: e.quantity }, () => ({
        instanceId: crypto.randomUUID(),
        cardDefinitionId: e.cardDefinitionId,
        face: 'back' as const,
        rotationDeg: 0
      }))
    );
    shuffleInstances(launched);
    expect(d).toEqual(snapshot);
  });
});
