import {
  createProject,
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

const CARD_W = 635;
const CARD_H = 889;

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s);
  ctx.bezierCurveTo(cx - s * 1.15, cy + s * 0.25, cx - s * 0.92, cy - s * 0.85, cx, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.92, cy - s * 0.85, cx + s * 1.15, cy + s * 0.25, cx, cy + s);
  ctx.closePath();
  ctx.fill();
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.72, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s * 0.72, cy);
  ctx.closePath();
  ctx.fill();
}

function club(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const r = s * 0.36;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.42, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - s * 0.4, cy + s * 0.16, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.4, cy + s * 0.16, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.16, cy + s * 0.95);
  ctx.lineTo(cx + s * 0.16, cy + s * 0.95);
  ctx.lineTo(cx, cy + s * 0.05);
  ctx.closePath();
  ctx.fill();
}

function spade(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 1.0, cy - s * 0.05, cx + s * 0.72, cy + s * 0.62, cx + s * 0.16, cy + s * 0.72);
  ctx.lineTo(cx + s * 0.34, cy + s);
  ctx.lineTo(cx - s * 0.34, cy + s);
  ctx.lineTo(cx - s * 0.16, cy + s * 0.72);
  ctx.bezierCurveTo(cx - s * 0.72, cy + s * 0.62, cx - s * 1.0, cy - s * 0.05, cx, cy - s);
  ctx.closePath();
  ctx.fill();
}

function drawSuit(ctx: CanvasRenderingContext2D, suit: string, cx: number, cy: number, size: number) {
  switch (suit) {
    case 'hearts':
      heart(ctx, cx, cy, size);
      break;
    case 'diamonds':
      diamond(ctx, cx, cy, size);
      break;
    case 'clubs':
      club(ctx, cx, cy, size);
      break;
    default:
      spade(ctx, cx, cy, size);
  }
}

/**
 * Draw one playing card face: rank in the corners, suit glyph beside it, and
 * the pips arranged the way a real card arranges them. Deliberately plain -
 * recognisable at a glance, not trying to be a illustrated deck.
 */
export function renderStandardCard(spec: StandardCardSpec): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#fbf7f0';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = '#d8d2c4';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, CARD_W - 28, CARD_H - 28);

  ctx.fillStyle = spec.suit.color;

  // Corner labels (top-left, and the same block rotated 180° bottom-right).
  const label = (cx: number, cy: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.font = 'bold 92px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.rank, 0, -34);
    ctx.font = '72px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(spec.suit.glyph, 0, 34);
    ctx.restore();
  };
  label(70, 90);
  ctx.save();
  ctx.translate(CARD_W - 70, CARD_H - 90);
  ctx.rotate(Math.PI);
  ctx.fillStyle = spec.suit.color;
  ctx.font = 'bold 92px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.rank, 0, -34);
  ctx.font = '72px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(spec.suit.glyph, 0, 34);
  ctx.restore();

  // Pips.
  const pipSize = spec.rank === 'A' ? 110 : spec.pips.length > 6 ? 62 : 78;
  for (const pip of spec.pips) {
    drawSuit(ctx, spec.suit.id, pip.x * CARD_W, pip.y * CARD_H, pipSize);
  }

  // Face cards get a monogram frame so they read as J/Q/K at a glance.
  if (spec.rank === 'J' || spec.rank === 'Q' || spec.rank === 'K') {
    ctx.strokeStyle = spec.suit.color;
    ctx.lineWidth = 4;
    ctx.strokeRect(120, 150, CARD_W - 240, CARD_H - 300);
    ctx.font = 'bold 150px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.rank, CARD_W / 2, CARD_H / 2);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode card image'))), 'image/png');
  });
}

/**
 * Create a project containing a real 52-card deck (4 suits x 13 ranks) with a
 * classic generated back, already dealt onto a table. No uploads required.
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
    const blob = await renderStandardCard(spec);
    const assetId = crypto.randomUUID();
    await saveImageAsset(
      {
        id: assetId,
        projectId: project.id,
        blobKey: crypto.randomUUID(),
        filename: `${spec.name}.png`,
        mime: 'image/png',
        widthPx: CARD_W,
        heightPx: CARD_H,
        sha256: `standard-${spec.id}`,
        createdAt: now
      },
      blob
    );

    const thumbnail = await makeThumbnail(blob);
    if (thumbnail) {
      await saveThumbnail({
        assetId,
        projectId: project.id,
        dataUrl: thumbnail,
        widthPx: CARD_W,
        heightPx: CARD_H
      });
    }

    const cardId = crypto.randomUUID();
    await saveCardDefinition({
      id: cardId,
      projectId: project.id,
      name: spec.name,
      frontAssetId: assetId,
      frontTransform: DEFAULT_TRANSFORM,
      widthMm: 63.5,
      heightMm: 88.9,
      tags: ['standard deck', 'poker']
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
