import { shuffleInstances } from './deck-operations';
import { CardInstance, TableObject, TABLE_HEIGHT, TABLE_WIDTH } from './models';

/**
 * Pure table operations. Every function takes state and returns new state;
 * inputs are never mutated. Deck recipes are never touched by these ops.
 */

export function flipInstance(instance: CardInstance): CardInstance {
  return { ...instance, face: instance.face === 'front' ? 'back' : 'front' };
}

export function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function rotateObject(object: TableObject, deg: number): TableObject {
  return { ...object, rotationDeg: normalizeRotation(object.rotationDeg + deg) };
}

export function moveObject(object: TableObject, x: number, y: number): TableObject {
  const clampedX = Math.min(Math.max(x, 0), TABLE_WIDTH);
  const clampedY = Math.min(Math.max(y, 0), TABLE_HEIGHT);
  return { ...object, x: clampedX, y: clampedY };
}

/** Launch a deck recipe onto the table as one face-down stack. */
export function launchDeck(
  deckEntries: { cardDefinitionId: string; quantity: number }[],
  sourceDeckId: string,
  label: string,
  x = TABLE_WIDTH / 2,
  y = TABLE_HEIGHT / 2
): TableObject {
  const instances: CardInstance[] = [];
  for (const entry of deckEntries) {
    for (let i = 0; i < entry.quantity; i++) {
      instances.push({
        instanceId: crypto.randomUUID(),
        cardDefinitionId: entry.cardDefinitionId,
        face: 'back',
        rotationDeg: 0
      });
    }
  }
  return {
    id: crypto.randomUUID(),
    type: 'stack',
    x,
    y,
    z: 0,
    rotationDeg: 0,
    cardInstances: instances,
    label,
    sourceDeckId
  };
}

/**
 * Drop a card onto a stack: merge preserving the stack's order, top = last.
 * Returns the merged stack and removes the dropped object.
 * (Empty stacks are removed by the caller — MVP behaviour.)
 */
export function mergeStack(target: TableObject, dropped: TableObject): TableObject {
  return {
    ...target,
    cardInstances: [...target.cardInstances, ...dropped.cardInstances]
  };
}

/** Draw 1 from a stack into a loose face-down card offset beside it. */
export function drawFromStack(stack: TableObject, objects: TableObject[]): TableObject[] {
  const { drawn, remaining } = drawTopFromObject(stack);
  const result = objects.filter((o) => o.id !== stack.id);
  if (remaining.length > 0) {
    result.push({ ...stack, cardInstances: remaining });
  }
  if (drawn) {
    result.push({
      id: crypto.randomUUID(),
      type: 'card',
      x: stack.x + 70,
      y: stack.y,
      z: stack.z + 1,
      rotationDeg: 0,
      cardInstances: [drawn]
    });
  }
  return result;
}

function drawTopFromObject(stack: TableObject): {
  drawn: CardInstance | null;
  remaining: CardInstance[];
} {
  const instances = stack.cardInstances;
  if (instances.length === 0) return { drawn: null, remaining: [] };
  return {
    drawn: instances[instances.length - 1],
    remaining: instances.slice(0, instances.length - 1)
  };
}

/** Shuffle the instances inside a stack; recipe untouched. */
export function shuffleStack(stack: TableObject, objects: TableObject[]): TableObject[] {
  return objects.map((o) =>
    o.id === stack.id
      ? { ...o, cardInstances: shuffleInstances(o.cardInstances) }
      : o
  );
}
