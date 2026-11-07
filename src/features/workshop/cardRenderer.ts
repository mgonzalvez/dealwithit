import { CardDefinition } from '../../domain/models';
import { DEFAULT_TRANSFORM } from '../../domain/transforms';
import { GeneratedBack, Shape, generateBackGeometry } from '../../domain/back-designs';

export function loadImage(blob: Blob): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  switch (shape.kind) {
    case 'rect':
      ctx.fillStyle = shape.fill;
      ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      break;
    case 'circle': {
      ctx.beginPath();
      ctx.arc(shape.cx, shape.cy, Math.max(0.5, shape.r), 0, Math.PI * 2);
      if (shape.fill) {
        ctx.fillStyle = shape.fill;
        ctx.fill();
      } else if (shape.stroke) {
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = Math.max(1, shape.width ?? 1);
        ctx.stroke();
      }
      break;
    }
    case 'line':
      ctx.strokeStyle = shape.stroke;
      ctx.lineWidth = Math.max(1, shape.width);
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
      break;
    case 'path':
      ctx.strokeStyle = shape.stroke;
      ctx.lineWidth = Math.max(1, shape.width);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < shape.points.length; i += 2) {
        if (i === 0) ctx.moveTo(shape.points[i], shape.points[i + 1]);
        else ctx.lineTo(shape.points[i], shape.points[i + 1]);
      }
      ctx.stroke();
      break;
    case 'poly':
      ctx.fillStyle = shape.fill;
      ctx.beginPath();
      for (let i = 0; i < shape.points.length; i += 2) {
        if (i === 0) ctx.moveTo(shape.points[i], shape.points[i + 1]);
        else ctx.lineTo(shape.points[i], shape.points[i + 1]);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'text':
      ctx.save();
      ctx.translate(shape.cx, shape.cy);
      ctx.rotate((shape.rotateDeg * Math.PI) / 180);
      ctx.fillStyle = shape.color;
      ctx.font = `700 ${shape.size}px -apple-system, BlinkMacSystemFont, "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.text, 0, 0);
      ctx.restore();
      break;
  }
}

/**
 * Draw a procedurally generated card back. Deterministic for a given design:
 * the pattern comes from a seeded PRNG, so the same JSON always looks the same.
 */
export function drawGeneratedBack(
  ctx: CanvasRenderingContext2D,
  design: GeneratedBack,
  width: number,
  height: number
): void {
  ctx.fillStyle = design.base;
  ctx.fillRect(0, 0, width, height);
  for (const shape of generateBackGeometry(design, width, height)) drawShape(ctx, shape);

  const frame = Math.min(width, height) * 0.04 * design.border;
  if (frame > 0) {
    ctx.strokeStyle = design.ink;
    ctx.lineWidth = Math.max(1, frame * 0.6);
    ctx.strokeRect(frame / 2, frame / 2, width - frame, height - frame);
  }
}

/**
 * The fallback back for a card nobody gave a back to. It is not a flat grey
 * rectangle: it reads as a real generic playing-card back — dark blue felt,
 * a double frame, a diamond lattice and a centre emblem.
 */
export function drawNeutralBack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const base = '#1f3a52';
  const ink = '#8fb2e6';
  const accent = '#2f5c86';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const step = Math.max(10, Math.round(Math.min(width, height) / 7));
  ctx.fillStyle = accent;
  for (let y = 0; y < height + step; y += step) {
    for (let x = 0; x < width + step; x += step) {
      const cx = x + (Math.floor(y / step) % 2 === 0 ? step / 2 : 0);
      const cy = y;
      ctx.beginPath();
      ctx.moveTo(cx, cy - step * 0.34);
      ctx.lineTo(cx + step * 0.34, cy);
      ctx.lineTo(cx, cy + step * 0.34);
      ctx.lineTo(cx - step * 0.34, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  const inset = Math.min(width, height) * 0.06;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, inset * 0.35);
  ctx.strokeRect(inset / 2, inset / 2, width - inset, height - inset);
  ctx.lineWidth = Math.max(1, inset * 0.15);
  ctx.strokeRect(inset * 1.4, inset * 1.4, width - inset * 2.8, height - inset * 2.8);

  // Centre emblem: a small card inside a circle.
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.16;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, radius * 0.09);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius * 0.55);
  ctx.lineTo(cx + radius * 0.55, cy);
  ctx.lineTo(cx, cy + radius * 0.55);
  ctx.lineTo(cx - radius * 0.55, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a card definition onto a canvas applying its non-destructive
 * transform (rotation, fit, zoom, pan). The original image blob is never
 * modified — this is presentation only and is reused by the Table (M3).
 */
export function renderCardPreview(
  card: CardDefinition,
  frontImage: HTMLImageElement | null,
  backImage: HTMLImageElement | null,
  face: 'front' | 'back',
  canvas: HTMLCanvasElement,
  maxPx = 420,
  backDesign?: GeneratedBack
): void {
  const ratio = card.widthMm / card.heightMm;
  const width = ratio >= 1 ? maxPx : Math.round(maxPx * ratio);
  const height = ratio >= 1 ? Math.round(maxPx / ratio) : maxPx;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f6f1e7';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#c9c2b2';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  const image = face === 'front' ? frontImage : backImage;
  if (!image) {
    if (face === 'back') {
      if (backDesign) drawGeneratedBack(ctx, backDesign, width, height);
      else drawNeutralBack(ctx, width, height);
      return;
    }
    // A front with no image is just the blank card stock.
    return;
  }

  const transform = (face === 'front' ? card.frontTransform : card.backTransform) ?? DEFAULT_TRANSFORM;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const fitScale = transform.fit === 'contain' ? Math.min(width / iw, height / ih) : Math.max(width / iw, height / ih);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.translate(width / 2 + transform.offsetX, height / 2 + transform.offsetY);
  ctx.rotate((transform.rotationDeg * Math.PI) / 180);
  ctx.scale(transform.scale * fitScale, transform.scale * fitScale);
  ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
}
