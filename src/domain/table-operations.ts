import { dealN, shuffleInstances } from './deck-operations';
import { CardInstance, clampWorld, TableObject, TABLE_HEIGHT, TABLE_WIDTH } from './models';

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
  // No table edge to bump against — only a generous sanity limit.
  return { ...object, x: clampWorld(x), y: clampWorld(y) };
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
      z: Math.max(...objects.map((o) => o.z), 0) + 1,
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
      z: Math.max(...objects.map((o) => o.z), 0) + 1,
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
      x: clampWorld(source.x + offset),
      y: clampWorld(source.y + offset),
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
      // Reassemble where the cards were, not at some fixed table centre.
      x: clampWorld(obj.x),
      y: clampWorld(obj.y),
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

/**
 * Cut a stack: lift the top `fraction` of the pack and set it down beside the
 * rest, the way you would cut a real deck. The recipe is never touched.
 */
export function cutStack(stack: TableObject, objects: TableObject[], fraction = 0.5): TableObject[] {
  const total = stack.cardInstances.length;
  if (stack.type !== 'stack' || total < 2) return objects;
  const cut = Math.max(1, Math.min(total - 1, Math.round(total * fraction)));
  const bottom = stack.cardInstances.slice(0, total - cut);
  const top = stack.cardInstances.slice(total - cut);
  const size = 127;
  const result = objects.filter((o) => o.id !== stack.id);
  if (bottom.length > 0) result.push({ ...stack, cardInstances: bottom });
  result.push({
    id: crypto.randomUUID(),
    type: 'stack',
    x: Math.min(1600 - size / 2, stack.x + size * 1.2),
    y: stack.y,
    z: Math.max(...objects.map((o) => o.z), 0) + 1,
    rotationDeg: 0,
    cardInstances: top,
    label: stack.label,
    sourceDeckId: stack.sourceDeckId
  });
  return result;
}

/**
 * Group operations. `sizeOf` gives the physical size of an object so spacing
 * works for bridge cards, poker cards, minis — whatever the player is using.
 */
export type SizeOf = (object: TableObject) => { w: number; h: number };

function byReadingOrder(objects: TableObject[]): TableObject[] {
  return [...objects].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Lay the selected cards out in a neat left-to-right row. */
export function arrangeInRow(
  objects: TableObject[],
  ids: string[],
  sizeOf: SizeOf,
  gap = 14
): TableObject[] {
  const selected = byReadingOrder(objects.filter((o) => ids.includes(o.id)));
  if (selected.length < 2) return objects;
  const placed = new Map<string, { x: number; y: number }>();
  let cursor = selected[0].x;
  const rowY = selected.reduce((sum, o) => sum + o.y, 0) / selected.length;
  for (const object of selected) {
    placed.set(object.id, { x: cursor, y: rowY });
    cursor += sizeOf(object).w + gap;
  }
  return objects.map((o) => (placed.has(o.id) ? { ...o, x: placed.get(o.id)!.x, y: placed.get(o.id)!.y } : o));
}

/** Lay the selected cards out in a grid, roughly square, reading order preserved. */
export function arrangeInGrid(
  objects: TableObject[],
  ids: string[],
  sizeOf: SizeOf,
  gap = 14
): TableObject[] {
  const selected = byReadingOrder(objects.filter((o) => ids.includes(o.id)));
  if (selected.length < 2) return objects;
  const columns = Math.max(1, Math.ceil(Math.sqrt(selected.length)));
  const cellW = Math.max(...selected.map((o) => sizeOf(o).w)) + gap;
  const cellH = Math.max(...selected.map((o) => sizeOf(o).h)) + gap;
  const startX = selected[0].x;
  const startY = selected[0].y;
  const placed = new Map<string, { x: number; y: number }>();
  selected.forEach((object, index) => {
    placed.set(object.id, {
      x: startX + (index % columns) * cellW,
      y: startY + Math.floor(index / columns) * cellH
    });
  });
  return objects.map((o) => (placed.has(o.id) ? { ...o, x: placed.get(o.id)!.x, y: placed.get(o.id)!.y } : o));
}

/**
 * Gather the selection into one pile. If a stack is part of the selection the
 * other cards are absorbed into it; otherwise a new stack is built where the
 * group roughly is.
 */
export function gatherGroup(objects: TableObject[], ids: string[]): TableObject[] {
  const selected = objects.filter((o) => ids.includes(o.id));
  if (selected.length < 2) return objects;

  const target = selected.find((o) => o.type === 'stack' && o.cardInstances.length > 0);
  if (target) {
    const absorbedIds = selected.filter((o) => o.id !== target.id).map((o) => o.id);
    if (absorbedIds.length === 0) return objects;
    const absorbed = selected
      .filter((o) => absorbedIds.includes(o.id))
      .flatMap((o) => o.cardInstances);
    return objects
      .filter((o) => !absorbedIds.includes(o.id))
      .map((o) => (o.id === target.id ? { ...o, cardInstances: [...o.cardInstances, ...absorbed] } : o));
  }

  const loose = selected.filter((o) => o.cardInstances.length > 0);
  if (loose.length < 2) return objects;
  const instances = loose.flatMap((o) => o.cardInstances);
  const x = loose.reduce((sum, o) => sum + o.x, 0) / loose.length;
  const y = loose.reduce((sum, o) => sum + o.y, 0) / loose.length;
  const z = Math.max(...selected.map((o) => o.z), 0);
  const sourceDeckId = loose.find((o) => o.sourceDeckId)?.sourceDeckId;
  return [
    ...objects.filter((o) => !loose.some((l) => l.id === o.id)),
    {
      id: crypto.randomUUID(),
      type: 'stack',
      x: clampWorld(x),
      y: clampWorld(y),
      z,
      rotationDeg: 0,
      cardInstances: instances,
      label: 'Gathered cards',
      sourceDeckId
    }
  ];
}

/** Return every selected card to its source deck (creating one if needed). */
export function returnGroupToDeck(objects: TableObject[], ids: string[]): TableObject[] {
  let result = [...objects];
  for (const id of ids) {
    const object = result.find((o) => o.id === id);
    if (!object) continue;
    result = returnToDeck(result, object);
  }
  return result;
}
