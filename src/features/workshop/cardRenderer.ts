import { CardDefinition } from '../../domain/models';
import { DEFAULT_TRANSFORM } from '../../domain/transforms';

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
  maxPx = 420
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
    // Neutral generated back.
    ctx.fillStyle = '#3b4a40';
    ctx.fillRect(2, 2, width - 4, height - 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 10; x < width; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x, height - 2);
      ctx.stroke();
    }
    for (let y = 10; y < height; y += 22) {
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(width - 2, y);
      ctx.stroke();
    }
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
