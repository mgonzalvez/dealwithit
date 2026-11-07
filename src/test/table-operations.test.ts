import { describe, it, expect } from 'vitest';
import {
  bringToFront,
  cutStack,
  dealFromStack,
  drawFromStack,
  duplicateObject,
  flipInstance,
  flipTop,
  gatherInto,
  launchDeck,
  mergeStack,
  moveObject,
  normalizeRotation,
  removeObject,
  returnToDeck,
  rotateObject,
  sendToBack,
  shuffleStack
} from '../domain/table-operations';
import { CardInstance, TableObject, WORLD_LIMIT } from '../domain/models';

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

  it('moveObject has no table edge, but keeps coordinates sane', () => {
    const obj = { id: 'o1', type: 'card' as const, x: 0, y: 0, z: 0, rotationDeg: 0, cardInstances: [] };
    // The felt is endless: negative and far-out positions are fine.
    expect(moveObject(obj, -50, 50).x).toBe(-50);
    expect(moveObject(obj, 2500, 3000).x).toBe(2500);
    expect(moveObject(obj, 2500, 3000).y).toBe(3000);
    // Only absurd distances are clipped, so a lost card can never drift forever.
    expect(moveObject(obj, 99999, -99999).x).toBe(WORLD_LIMIT);
    expect(moveObject(obj, 99999, -99999).y).toBe(-WORLD_LIMIT);
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

  it('drawn cards remember their source deck', () => {
    const s = stack(4);
    const objects = drawFromStack(s, [s]);
    const loose = objects.find((o) => o.type === 'card');
    expect(loose?.sourceDeckId).toBe('deck-1');
  });

  it('draws face-up when the table setting says so', () => {
    const s = stack(4);
    const objects = drawFromStack(s, [s], { faceUp: true });
    const loose = objects.find((o) => o.type === 'card');
    expect(loose?.cardInstances[0].face).toBe('front');
    const dealt = dealFromStack(s, [s], 2, { faceUp: true });
    expect(dealt.filter((o) => o.type === 'card').every((o) => o.cardInstances[0].face === 'front')).toBe(true);
  });
});

describe('dealing, stacking and z-order', () => {
  it('dealFromStack removes from the top and creates loose face-down cards', () => {
    const s = stack(10);
    const objects = dealFromStack(s, [s], 3);
    const remaining = objects.find((o) => o.id === 'stack-1');
    const loose = objects.filter((o) => o.type === 'card');
    expect(remaining?.cardInstances.length).toBe(7);
    expect(loose.length).toBe(3);
    expect(loose.every((o) => o.cardInstances[0].face === 'back')).toBe(true);
    // Dealt cards keep bottom-to-top order (top of pile = last dealt).
    expect(loose.map((o) => o.cardInstances[0].instanceId)).toEqual(['inst-7', 'inst-8', 'inst-9']);
  });

  it('flipTop toggles only the top instance', () => {
    const s = stack(3);
    const flipped = flipTop(s);
    expect(flipped.cardInstances[2].face).toBe('front');
    expect(flipped.cardInstances[0].face).toBe('back');
    expect(flipTop(flipTop(s)).cardInstances[2].face).toBe('back');
  });

  it('gatherInto absorbs loose cards near the stack and preserves stack order', () => {
    const s = stack(2);
    const near: TableObject = {
      id: 'near',
      type: 'card',
      x: s.x + 50,
      y: s.y + 30,
      z: 1,
      rotationDeg: 0,
      cardInstances: [{ instanceId: 'n1', cardDefinitionId: 'c', face: 'front', rotationDeg: 0 }]
    };
    const far: TableObject = {
      id: 'far',
      type: 'card',
      x: s.x + 500,
      y: s.y,
      z: 1,
      rotationDeg: 0,
      cardInstances: [{ instanceId: 'f1', cardDefinitionId: 'c', face: 'front', rotationDeg: 0 }]
    };
    const result = gatherInto(s, [s, near, far], 160);
    expect(result.length).toBe(2);
    const merged = result.find((o) => o.id === 'stack-1');
    expect(merged?.cardInstances.map((c) => c.instanceId)).toEqual(['inst-0', 'inst-1', 'n1']);
    expect(result.find((o) => o.id === 'far')).toBeDefined();
  });

  it('returnToDeck puts a drawn card back on top of its stack', () => {
    const s = stack(5);
    const withDraw = drawFromStack(s, [s]);
    const loose = withDraw.find((o) => o.type === 'card')!;
    const result = returnToDeck(withDraw, loose);
    const restored = result.find((o) => o.type === 'stack');
    expect(restored?.cardInstances.length).toBe(5);
    expect(result.length).toBe(1);
  });

  it('returnToDeck recreates a stack when the original is gone', () => {
    const s = stack(1);
    const withDraw = drawFromStack(s, [s]); // stack emptied and removed
    const loose = withDraw.find((o) => o.type === 'card')!;
    const result = returnToDeck(withDraw, loose);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('stack');
    expect(result[0].cardInstances.length).toBe(1);
  });

  it('bringToFront and sendToBack adjust z-order', () => {
    const a = stack(2);
    const b: TableObject = { id: 'b', type: 'card', x: 10, y: 10, z: 5, rotationDeg: 0, cardInstances: [] };
    const front = bringToFront([a, b], 'stack-1');
    expect(front.find((o) => o.id === 'stack-1')!.z).toBe(6);
    const back = sendToBack(front, 'stack-1');
    expect(back.find((o) => o.id === 'stack-1')!.z).toBe(-1);
  });

  it('duplicateObject creates a copy with fresh object and instance IDs', () => {
    const s = stack(3);
    const result = duplicateObject([s], 'stack-1');
    expect(result.length).toBe(2);
    const copy = result[1];
    expect(copy.id).not.toBe(s.id);
    expect(copy.cardInstances.length).toBe(3);
    expect(copy.cardInstances.every((c) => !s.cardInstances.some((o) => o.instanceId === c.instanceId))).toBe(true);
  });

  it('removeObject removes only the target', () => {
    const s = stack(2);
    const other: TableObject = { id: 'other', type: 'card', x: 0, y: 0, z: 0, rotationDeg: 0, cardInstances: [] };
    expect(removeObject([s, other], 'other').length).toBe(1);
  });
});

describe('cutting a deck', () => {
  it('splits the pack into two stacks without touching the recipe', () => {
    const s = stack(10);
    const objects = cutStack(s, [s], 0.5);
    const piles = objects.filter((o) => o.type === 'stack');
    expect(piles.length).toBe(2);
    expect(piles.reduce((sum, pile) => sum + pile.cardInstances.length, 0)).toBe(10);
    const lifted = piles.find((pile) => pile.id !== s.id);
    expect(lifted?.cardInstances.length).toBe(5);
    expect(lifted?.cardInstances[0].instanceId).toBe('inst-5');
    expect(lifted?.sourceDeckId).toBe(s.sourceDeckId);
  });

  it('does nothing with a stack too small to cut', () => {
    const s = stack(1);
    expect(cutStack(s, [s], 0.5).length).toBe(1);
  });

  it('dealt cards land with a small off-square jitter (never more than 2 degrees)', () => {
    const s = stack(12);
    const objects = dealFromStack(s, [s], 6);
    for (const object of objects.filter((o) => o.type === 'card')) {
      expect(Math.abs(object.rotationDeg)).toBeLessThanOrEqual(2);
    }
  });
});
