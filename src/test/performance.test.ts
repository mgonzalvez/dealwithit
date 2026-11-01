import { describe, it, expect } from 'vitest';
import { shuffleInstances, drawTop } from '../domain/deck-operations';
import { launchDeck, dealFromStack } from '../domain/table-operations';
import { CardInstance } from '../domain/models';

/**
 * Performance sanity checks at the spec's target scale
 * (500 images, 10 decks, 300 instances on a table).
 */
describe('performance budgets', () => {
  it('shuffles 300 instances well under a frame budget', () => {
    const instances: CardInstance[] = Array.from({ length: 300 }, (_, i) => ({
      instanceId: `i-${i}`,
      cardDefinitionId: `c-${i % 50}`,
      face: 'back' as const,
      rotationDeg: 0
    }));
    const start = performance.now();
    for (let round = 0; round < 100; round++) shuffleInstances(instances);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // 100 shuffles of 300 cards in well under 200ms
  });

  it('launches and deals a 10-deck, 300-card table quickly', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      cardDefinitionId: `c-${i}`,
      quantity: 30
    }));
    const start = performance.now();
    let objects: ReturnType<typeof launchDeck>[] = [];
    for (let deck = 0; deck < 10; deck++) {
      objects.push(launchDeck(entries, `deck-${deck}`, `Deck ${deck}`, 200 + deck * 120, 500));
    }
    for (const stack of [...objects]) {
      objects = dealFromStack(stack, objects, 25);
    }
    const elapsed = performance.now() - start;
    expect(objects.length).toBeGreaterThan(10);
    expect(elapsed).toBeLessThan(200);
  });

  it('drawing one card at a time from a 300-card stack stays fast', () => {
    const stack = launchDeck(
      Array.from({ length: 100 }, (_, i) => ({ cardDefinitionId: `c-${i}`, quantity: 3 })),
      'deck-big',
      'Big deck'
    );
    const start = performance.now();
    let objects = [stack];
    let remaining = stack;
    for (let i = 0; i < 300; i++) {
      objects = drawFromStackLoop(objects, remaining);
      remaining = objects.find((o) => o.type === 'stack') ?? remaining;
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});

function drawFromStackLoop(objects: ReturnType<typeof launchDeck>[], stack: ReturnType<typeof launchDeck>) {
  const { drawn, remaining } = drawTop(stack.cardInstances);
  const rest = objects.filter((o) => o.id !== stack.id);
  if (remaining.length > 0) {
    const updated = { ...stack, cardInstances: remaining };
    return [...rest, updated];
  }
  void drawn;
  return rest;
}
