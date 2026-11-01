import { describe, it, expect } from 'vitest';
import {
  drawFromStack,
  flipInstance,
  launchDeck,
  mergeStack,
  moveObject,
  normalizeRotation,
  rotateObject,
  shuffleStack
} from '../domain/table-operations';
import { CardInstance, TableObject } from '../domain/models';

function stack(n: number): TableObject {
  return {
    id: 'stack-1',
    type: 'stack',
    x: 100,
    y: 100,
    z: 0,
    rotationDeg: 0,
    label: 'Main Deck',
    sourceDeckId: 'deck-1',
    cardInstances: Array.from({ length: n }, (_, i) => ({
      instanceId: `inst-${i}`,
      cardDefinitionId: 'card-a',
      face: 'back' as const,
      rotationDeg: 0
    }))
  };
}

describe('flip', () => {
  it('flip is reversible', () => {
    const card: CardInstance = {
      instanceId: 'i1',
      cardDefinitionId: 'c1',
      face: 'back',
      rotationDeg: 0
    };
    expect(flipInstance(flipInstance(card))).toEqual(card);
  });
});

describe('rotation and movement', () => {
  it('normalizes rotations to 0..359', () => {
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
  });

  it('moveObject clamps to the table bounds', () => {
    const obj = { id: 'o1', type: 'card' as const, x: 0, y: 0, z: 0, rotationDeg: 0, cardInstances: [] };
    expect(moveObject(obj, -50, 50).x).toBe(0);
    expect(moveObject(obj, 9999, 9999).x).toBe(1600);
    expect(moveObject(obj, 9999, 9999).y).toBe(1000);
  });

  it('rotateObject adds rotation and normalizes', () => {
    const obj = stack(1);
    const rotated = rotateObject(obj, 270);
    expect(rotateObject(rotated, 90).rotationDeg).toBe(0);
  });
});

describe('launchDeck', () => {
  it('creates one face-down stack with the right instance count', () => {
    const recipe = [
      { cardDefinitionId: 'a', quantity: 3 },
      { cardDefinitionId: 'b', quantity: 2 }
    ];
    const frozen = structuredClone(recipe);
    const obj = launchDeck(recipe, 'deck-1', 'Main Deck');
    expect(obj.type).toBe('stack');
    expect(obj.cardInstances.length).toBe(5);
    expect(obj.cardInstances.every((c) => c.face === 'back')).toBe(true);
    expect(recipe).toEqual(frozen);
  });
});

describe('stack merging', () => {
  it('merges preserving order, top of stack last', () => {
    const target = stack(2);
    const dropped: TableObject = {
      id: 'card-9',
      type: 'card',
      x: 0,
      y: 0,
      z: 1,
      rotationDeg: 0,
      cardInstances: [
        { instanceId: 'x', cardDefinitionId: 'c', face: 'front', rotationDeg: 0 }
      ]
    };
    const merged = mergeStack(target, dropped);
    expect(merged.cardInstances.map((c) => c.instanceId)).toEqual(['inst-0', 'inst-1', 'x']);
  });
});

describe('table draws and shuffles', () => {
  it('drawing removes the top instance and creates a face-down loose card', () => {
    const s = stack(4);
    const objects = drawFromStack(s, [s]);
    const remaining = objects.find((o) => o.id === 'stack-1');
    const loose = objects.find((o) => o.type === 'card');
    expect(remaining?.cardInstances.length).toBe(3);
    expect(loose?.cardInstances.length).toBe(1);
    expect(loose?.cardInstances[0].face).toBe('back');
  });

  it('shuffling preserves the multiset of instances and not the recipe', () => {
    const s = stack(50);
    const before = s.cardInstances.map((c) => c.instanceId).sort();
    const [after] = shuffleStack(s, [s]);
    const afterIds = after.cardInstances.map((c) => c.instanceId).sort();
    expect(afterIds).toEqual(before);
  });

  it('emptying a stack removes it from the table', () => {
    const s = stack(1);
    const objects = drawFromStack(s, [s]);
    expect(objects.find((o) => o.id === 'stack-1')).toBeUndefined();
    expect(objects.length).toBe(1);
  });
});
