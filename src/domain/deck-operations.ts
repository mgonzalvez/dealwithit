import { CardInstance, DeckDefinition, DeckEntry } from './models';

/**
 * Unbiased random integer in [0, maxExclusive) using crypto.getRandomValues
 * with rejection sampling (no modulo bias).
 */
export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const limit = 0xffffffff;
  const threshold = Math.floor((limit + 1) / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value < threshold) return value % maxExclusive;
  }
}

/**
 * Fisher–Yates shuffle of card INSTANCES only.
 * cardInstances[0] is the bottom, the last element is the top.
 * Never shuffles a deck recipe.
 */
export function shuffleInstances(instances: CardInstance[]): CardInstance[] {
  const out = [...instances];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draw the top card (last instance) from a stack of instances.
 * Returns the drawn instance and the remaining stack.
 */
export function drawTop(instances: CardInstance[]): {
  drawn: CardInstance | null;
  remaining: CardInstance[];
} {
  if (instances.length === 0) return { drawn: null, remaining: [] };
  const remaining = instances.slice(0, instances.length - 1);
  return { drawn: instances[instances.length - 1], remaining };
}

/**
 * Deal `n` cards from the top of a stack.
 */
export function dealN(instances: CardInstance[], n: number): {
  dealt: CardInstance[];
  remaining: CardInstance[];
} {
  const count = Math.min(n, instances.length);
  return {
    dealt: instances.slice(instances.length - count),
    remaining: instances.slice(0, instances.length - count)
  };
}

/** Create a new deck recipe. */
export function createDeck(projectId: IDLike, name: string): DeckDefinition {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    name,
    entries: [],
    createdAt: now,
    updatedAt: now
  };
}

type IDLike = string;

/** Add a card definition to a deck recipe (quantity 1 unless specified). */
export function addEntryToDeck(
  deck: DeckDefinition,
  cardDefinitionId: string,
  quantity = 1
): DeckDefinition {
  const existing = deck.entries.find((e) => e.cardDefinitionId === cardDefinitionId);
  const entries: DeckEntry[] = existing
    ? deck.entries.map((e) =>
        e.cardDefinitionId === cardDefinitionId ? { ...e, quantity: e.quantity + quantity } : e
      )
    : [...deck.entries, { id: crypto.randomUUID(), cardDefinitionId, quantity }];
  return { ...deck, entries, updatedAt: Date.now() };
}

/** Increase quantity of an entry (duplicate in deck) without copying blobs. */
export function incrementEntry(deck: DeckDefinition, entryId: string, by = 1): DeckDefinition {
  return {
    ...deck,
    entries: deck.entries.map((e) =>
      e.id === entryId ? { ...e, quantity: Math.max(1, e.quantity + by) } : e
    ),
    updatedAt: Date.now()
  };
}

export function deckCardCount(deck: DeckDefinition): number {
  return deck.entries.reduce((sum, e) => sum + e.quantity, 0);
}

export function setEntryQuantity(
  deck: DeckDefinition,
  entryId: string,
  quantity: number
): DeckDefinition {
  const q = Math.max(1, Math.floor(quantity));
  return {
    ...deck,
    entries: deck.entries.map((e) => (e.id === entryId ? { ...e, quantity: q } : e)),
    updatedAt: Date.now()
  };
}

export function removeEntry(deck: DeckDefinition, entryId: string): DeckDefinition {
  return { ...deck, entries: deck.entries.filter((e) => e.id !== entryId), updatedAt: Date.now() };
}

export function moveEntry(deck: DeckDefinition, entryId: string, delta: -1 | 1): DeckDefinition {
  const index = deck.entries.findIndex((e) => e.id === entryId);
  if (index < 0) return deck;
  const target = index + delta;
  if (target < 0 || target >= deck.entries.length) return deck;
  const entries = [...deck.entries];
  [entries[index], entries[target]] = [entries[target], entries[index]];
  return { ...deck, entries, updatedAt: Date.now() };
}

export function renameDeck(deck: DeckDefinition, name: string): DeckDefinition {
  return { ...deck, name: name.trim() || deck.name, updatedAt: Date.now() };
}

export function setDefaultBack(deck: DeckDefinition, assetId: string | undefined): DeckDefinition {
  return { ...deck, defaultBackAssetId: assetId, updatedAt: Date.now() };
}

/** Copy a deck recipe. Entries get fresh IDs but reference the same card definitions (no blob duplication). */
export function duplicateDeck(deck: DeckDefinition, projectId: string): DeckDefinition {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    name: `${deck.name} (copy)`,
    entries: deck.entries.map((e) => ({
      id: crypto.randomUUID(),
      cardDefinitionId: e.cardDefinitionId,
      quantity: e.quantity
    })),
    defaultBackAssetId: deck.defaultBackAssetId,
    createdAt: now,
    updatedAt: now
  };
}
