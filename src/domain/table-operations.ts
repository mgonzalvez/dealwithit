import { dealN, shuffleInstances } from './deck-operations';
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

export interface DrawOptions {
  /** Draw face-up instead of the default face-down. */
  faceUp?: boolean;
}

/** Draw 1 from a stack into a loose card offset beside it. */
export function drawFromStack(
  stack: TableObject,
  objects: TableObject[],
  options: DrawOptions = {}
): TableObject[] {
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
      cardInstances: [{ ...drawn, face: options.faceUp ? 'front' : drawn.face }],
      sourceDeckId: stack.sourceDeckId
    });
  }
  return result;
}

/** Deal N cards from a stack into a grid of loose cards. */
export function dealFromStack(
  stack: TableObject,
  objects: TableObject[],
  n: number,
  options: DrawOptions = {}
): TableObject[] {
  const { dealt, remaining } = dealN(stack.cardInstances, n);
  const result = objects.filter((o) => o.id !== stack.id);
  if (remaining.length > 0) {
    result.push({ ...stack, cardInstances: remaining });
  }
  dealt.forEach((instance, i) => {
    result.push({
      id: crypto.randomUUID(),
      type: 'card',
      x: stack.x + 140 + (i % 8) * 80,
      y: stack.y + Math.floor(i / 8) * 90,
      z: stack.z + 1,
      rotationDeg: 0,
      cardInstances: [{ ...instance, face: options.faceUp ? 'front' : instance.face }],
      sourceDeckId: stack.sourceDeckId
    });
  });
  return result;
}

export function flipTop(object: TableObject): TableObject {
  if (object.cardInstances.length === 0) return object;
  const instances = [...object.cardInstances];
  instances[instances.length - 1] = flipInstance(instances[instances.length - 1]);
  return { ...object, cardInstances: instances };
}

export function removeObject(objects: TableObject[], id: string): TableObject[] {
  return objects.filter((o) => o.id !== id);
}

export function bringToFront(objects: TableObject[], id: string): TableObject[] {
  const maxZ = Math.max(...objects.map((o) => o.z), 0);
  return objects.map((o) => (o.id === id ? { ...o, z: maxZ + 1 } : o));
}

export function sendToBack(objects: TableObject[], id: string): TableObject[] {
  const minZ = Math.min(...objects.map((o) => o.z), 0);
  return objects.map((o) => (o.id === id ? { ...o, z: minZ - 1 } : o));
}

export function duplicateObject(objects: TableObject[], id: string, offset = 60): TableObject[] {
  const source = objects.find((o) => o.id === id);
  if (!source) return objects;
  return [
    ...objects,
    {
      ...source,
      id: crypto.randomUUID(),
      x: Math.min(TABLE_WIDTH, source.x + offset),
      y: Math.min(TABLE_HEIGHT, source.y + offset),
      z: source.z + 1,
      cardInstances: source.cardInstances.map((instance) => ({
        ...instance,
        instanceId: crypto.randomUUID()
      }))
    }
  ];
}

/** Absorb loose cards whose centers fall within `radius` of the stack center. */
export function gatherInto(stack: TableObject, objects: TableObject[], radius = 160): TableObject[] {
  const absorbed = objects.filter(
    (o) =>
      o.id !== stack.id &&
      o.type === 'card' &&
      Math.abs(o.x - stack.x) <= radius &&
      Math.abs(o.y - stack.y) <= radius
  );
  if (absorbed.length === 0) return objects;
  const absorbedInstances = absorbed.flatMap((o) => o.cardInstances);
  return objects
    .filter((o) => o.id === stack.id || !absorbed.some((a) => a.id === o.id))
    .map((o) =>
      o.id === stack.id ? { ...o, cardInstances: [...o.cardInstances, ...absorbedInstances] } : o
    );
}

/** Send a loose card (or cards) back to its source deck's stack, recreating the stack if needed. */
export function returnToDeck(objects: TableObject[], obj: TableObject): TableObject[] {
  const rest = removeObject(objects, obj.id);
  if (obj.cardInstances.length === 0) return rest;
  const stack = rest.find((o) => o.type === 'stack' && o.sourceDeckId === obj.sourceDeckId);
  if (stack) {
    return rest.map((o) =>
      o.id === stack.id ? { ...o, cardInstances: [...o.cardInstances, ...obj.cardInstances] } : o
    );
  }
  return [
    ...rest,
    {
      id: crypto.randomUUID(),
      type: 'stack',
      x: TABLE_WIDTH / 2,
      y: TABLE_HEIGHT / 2,
      z: 0,
      rotationDeg: 0,
      cardInstances: obj.cardInstances,
      label: 'Returned cards',
      sourceDeckId: obj.sourceDeckId
    }
  ];
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
