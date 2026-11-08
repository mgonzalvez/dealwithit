import {
  createProject,
  listCardDefinitions,
  saveCardDefinition,
  saveDeck,
  saveImageAsset,
  saveTable,
  saveThumbnail,
  touchProject
} from '../../persistence/repositories';
import { addEntryToDeck, createDeck, setGeneratedBack } from '../../domain/deck-operations';
import { launchDeck } from '../../domain/table-operations';
import { TABLE_HEIGHT, TABLE_WIDTH } from '../../domain/models';
import { makeBackDesign } from '../../domain/back-designs';
import { standardCardSpecs, StandardCardSpec } from '../../domain/standard-deck';
import { DEFAULT_TRANSFORM } from '../../domain/transforms';
import { makeThumbnail } from '../import/imageMeta';
import { renderStandardCard } from './standardCardArt';

const CARD_W = 635;
const CARD_H = 889;

/** Marker so an existing standard deck can be re-rendered when the art changes. */
const ART_TAG = 'standard-deck-art-v3';

async function renderCardArt(spec: StandardCardSpec, projectId: string, assetId: string) {
  const blob = await renderStandardCard(spec);
  await saveImageAsset(
    {
      id: assetId,
      projectId,
      blobKey: crypto.randomUUID(),
      filename: `${spec.name}.png`,
      mime: 'image/png',
      widthPx: CARD_W,
      heightPx: CARD_H,
      sha256: `standard-${spec.id}`,
      createdAt: Date.now()
    },
    blob
  );
  const thumbnail = await makeThumbnail(blob);
  if (thumbnail) {
    await saveThumbnail({
      assetId,
      projectId,
      dataUrl: thumbnail,
      widthPx: CARD_W,
      heightPx: CARD_H
    });
  }
  return blob;
}

/**
 * Create a project containing a real 52-card deck (4 suits x 13 ranks) with a
 * classic generated back, already sitting on a table. No uploads required.
 */
export async function createStandardDeckProject(): Promise<string> {
  const project = await createProject('Standard 52-card deck', 'A ready-made poker deck. Shuffle, deal, play.');
  const now = Date.now();
  let deck = createDeck(project.id, 'Standard Deck');
  deck = setGeneratedBack(
    deck,
    makeBackDesign({ pattern: 'diamonds', base: '#1f3a52', ink: '#8fb2e6', title: 'Standard Deck', showTitle: true, seed: 52 })
  );

  for (const spec of standardCardSpecs()) {
    const assetId = crypto.randomUUID();
    await renderCardArt(spec, project.id, assetId);

    const cardId = crypto.randomUUID();
    await saveCardDefinition({
      id: cardId,
      projectId: project.id,
      name: spec.name,
      frontAssetId: assetId,
      frontTransform: DEFAULT_TRANSFORM,
      widthMm: 63.5,
      heightMm: 88.9,
      tags: ['standard deck', 'poker', ART_TAG]
    });

    deck = addEntryToDeck(deck, cardId, 1);
  }

  await saveDeck(deck);
  await saveTable({
    id: crypto.randomUUID(),
    projectId: project.id,
    name: 'Main table',
    // The pack is already sitting on the felt, face down, ready to shuffle.
    objects: [launchDeck(deck.entries, deck.id, deck.name, TABLE_WIDTH / 2, TABLE_HEIGHT / 2)],
    camera: { x: 0, y: 0, zoom: 1 },
    background: '#15372a',
    updatedAt: now
  });
  await touchProject(project.id);
  return project.id;
}

/**
 * The deck's artwork is generated, not uploaded, so it can be improved without
 * the user losing their project: any standard deck still carrying an older art
 * tag gets its card images redrawn in place. Decks, tables and hands are
 * untouched.
 */
export async function refreshStandardDeckArt(projectId: string): Promise<boolean> {
  const cards = await listCardDefinitions(projectId);
  const standardCards = cards.filter((card) => card.tags?.includes('standard deck'));
  if (standardCards.length === 0) return false;
  if (standardCards.every((card) => card.tags?.includes(ART_TAG))) return false;

  const specs = new Map(standardCardSpecs().map((spec) => [spec.name.toLowerCase(), spec]));
  for (const card of standardCards) {
    const spec = specs.get(card.name.toLowerCase());
    if (!spec) continue;
    await renderCardArt(spec, projectId, card.frontAssetId);
    await saveCardDefinition({
      ...card,
      tags: [...(card.tags ?? []), ART_TAG]
    });
  }
  await touchProject(projectId);
  return true;
}
