/**
 * Playing-card artwork, drawn procedurally.
 *
 * Suits are vector geometry rather than text glyphs, so a heart looks like a
 * heart on every device and at every zoom — no dependence on whether the loaded
 * font actually contains ♥ ♦ ♣ ♠.
 */
import { StandardCardSpec } from '../../domain/standard-deck';

const CARD_W = 635;
const CARD_H = 889;
const STOCK = '#fbf7f0';

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s);
  ctx.bezierCurveTo(cx + s * 1.12, cy + s * 0.18, cx + s * 0.98, cy - s * 0.92, cx + s * 0.34, cy - s * 0.52);
  ctx.bezierCurveTo(cx, cy - s * 0.34, cx, cy - s * 0.34, cx - s * 0.34, cy - s * 0.52);
  ctx.bezierCurveTo(cx - s * 0.98, cy - s * 0.92, cx - s * 1.12, cy + s * 0.18, cx, cy + s);
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
  const r = s * 0.34;
  for (const [dx, dy] of [[0, -0.46], [-0.42, 0.1], [0.42, 0.1]]) {
    ctx.beginPath();
    ctx.arc(cx + dx * s, cy + dy * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stem flares outward at the bottom, like a real club.
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.3, cy + s);
  ctx.lineTo(cx + s * 0.3, cy + s);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
}

function spade(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 0.1, cx + s * 0.62, cy + s * 0.62, cx + s * 0.14, cy + s * 0.66);
  ctx.lineTo(cx + s * 0.3, cy + s);
  ctx.lineTo(cx - s * 0.3, cy + s);
  ctx.lineTo(cx - s * 0.14, cy + s * 0.66);
  ctx.bezierCurveTo(cx - s * 0.62, cy + s * 0.62, cx - s * 0.95, cy - s * 0.1, cx, cy - s);
  ctx.closePath();
  ctx.fill();
}

export function drawSuit(ctx: CanvasRenderingContext2D, suitId: string, cx: number, cy: number, size: number) {
  switch (suitId) {
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
 * Corner index: rank letter over a small suit emblem. The top-left one is
 * upright, the bottom-right one is turned around, exactly like a real card, so
 * the card reads the same whichever way up you are holding it.
 */
function cornerIndex(ctx: CanvasRenderingContext2D, spec: StandardCardSpec, cx: number, cy: number, upsideDown: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  if (upsideDown) ctx.rotate(Math.PI);
  ctx.fillStyle = spec.suit.color;
  ctx.font = 'bold 74px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.rank, 0, -22);
  drawSuit(ctx, spec.suit.id, 0, 32, 22);
  ctx.restore();
}

/**
 * Draw one playing card face: rank in the corners, pips in the middle, a framed
 * court panel for J/Q/K. Plain on purpose, but unmistakable at a glance.
 */
export function renderStandardCard(spec: StandardCardSpec): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const color = spec.suit.color;

  ctx.fillStyle = STOCK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = '#d7d0c2';
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, CARD_W - 32, CARD_H - 32);

  cornerIndex(ctx, spec, 62, 92, false);
  cornerIndex(ctx, spec, CARD_W - 62, CARD_H - 92, true);

  ctx.fillStyle = color;

  if (spec.rank === 'J' || spec.rank === 'Q' || spec.rank === 'K') {
    // Court card: double frame, big rank, one large emblem plus a mirrored
    // small one so the card reads the same whichever way up it is held.
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(118, 168, CARD_W - 236, CARD_H - 336);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(132, 182, CARD_W - 264, CARD_H - 364);

    ctx.font = 'bold 150px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.rank, CARD_W / 2, CARD_H / 2 - 130);

    drawSuit(ctx, spec.suit.id, CARD_W / 2, CARD_H / 2 + 90, 100);

    ctx.save();
    ctx.translate(CARD_W / 2, CARD_H / 2 + 235);
    ctx.rotate(Math.PI);
    drawSuit(ctx, spec.suit.id, 0, 0, 46);
    ctx.restore();
  } else {
    const pips = spec.pips;
    const pipSize = spec.rank === 'A' ? 110 : pips.length >= 9 ? 52 : 66;

    if (spec.rank === 'A') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CARD_W / 2, CARD_H / 2, 165, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
    }

    for (const pip of pips) {
      const cx = pip.x * CARD_W;
      const cy = pip.y * CARD_H;
      if (pip.flip) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI);
        drawSuit(ctx, spec.suit.id, 0, 0, pipSize);
        ctx.restore();
      } else {
        drawSuit(ctx, spec.suit.id, cx, cy, pipSize);
      }
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode card image'))), 'image/png');
  });
}
