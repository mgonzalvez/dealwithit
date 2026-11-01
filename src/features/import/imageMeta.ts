/**
 * Browser-only image helpers. Decoding happens in small batches so importing
 * 100 images does not freeze the UI, and only thumbnails (not full-res
 * bitmaps) stay resident for the library grid.
 */

export async function probeImage(blob: Blob): Promise<{ widthPx: number; heightPx: number } | null> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('decode failed'));
      image.src = url;
    });
    return { widthPx: image.naturalWidth, heightPx: image.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function makeThumbnail(blob: Blob, maxPx = 256): Promise<string | null> {
  try {
    const meta = await probeImage(blob);
    if (!meta) return null;
    const scale = Math.min(1, maxPx / Math.max(meta.widthPx, meta.heightPx));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(meta.widthPx * scale));
    canvas.height = Math.max(1, Math.round(meta.heightPx * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('decode failed'));
        img.src = url;
      });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
