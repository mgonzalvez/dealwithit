import { CardDefinition } from './models';

/** Create an independent copy of a card definition (same images, new id). */
export function duplicateCardDefinition(card: CardDefinition): CardDefinition {
  return {
    ...card,
    id: crypto.randomUUID(),
    name: `${card.name} (copy)`,
    tags: [...card.tags],
    frontTransform: { ...card.frontTransform },
    backTransform: card.backTransform ? { ...card.backTransform } : undefined
  };
}
