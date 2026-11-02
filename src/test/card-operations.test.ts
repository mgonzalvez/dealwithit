import { describe, it, expect } from 'vitest';
import { duplicateCardDefinition } from '../domain/card-operations';
import { CardDefinition } from '../domain/models';
import { DEFAULT_TRANSFORM } from '../domain/transforms';

const base: CardDefinition = {
  id: 'card-1',
  projectId: 'p1',
  name: 'Ace of Spades',
  frontAssetId: 'asset-1',
  backAssetId: 'asset-back',
  frontTransform: { ...DEFAULT_TRANSFORM },
  widthMm: 63.5,
  heightMm: 88.9,
  tags: ['solo']
};

describe('card operations', () => {
  it('duplicates a card with a fresh id and "(copy)" name, keeping image references', () => {
    const copy = duplicateCardDefinition(base);
    expect(copy.id).not.toBe(base.id);
    expect(copy.name).toBe('Ace of Spades (copy)');
    expect(copy.frontAssetId).toBe('asset-1');
    expect(copy.backAssetId).toBe('asset-back');
    expect(copy.widthMm).toBe(63.5);
    expect(copy.tags).toEqual(['solo']);
  });

  it('does not mutate the original card', () => {
    const snapshot = structuredClone(base);
    duplicateCardDefinition(base);
    expect(base).toEqual(snapshot);
  });
});
