import { ImageAsset, ImageMime } from '../../domain/models';

export const IMAGE_MIME_BY_EXT: Record<string, ImageMime> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

/** Larger files still import but get a warning (spec: warn, do not silently fail). */
export const WARN_SIZE_BYTES = 20 * 1024 * 1024;
/** Hard rejection per file. */
export const MAX_SIZE_BYTES = 60 * 1024 * 1024;

export interface ImportEntry {
  key: string;
  filename: string;
  source: 'upload' | 'zip';
  zipPath?: string;
  bytes: Uint8Array;
}

export type StagedStatus = 'valid' | 'duplicate' | 'unsupported' | 'invalid';

export interface StagedItem {
  key: string;
  filename: string;
  source: 'upload' | 'zip';
  zipPath?: string;
  status: StagedStatus;
  error?: string;
  warning?: string;
  mime?: ImageMime;
  sha256?: string;
  widthPx?: number;
  heightPx?: number;
  previewUrl?: string;
  bytes: Uint8Array;
}

export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/.exec(name.toLowerCase());
  return match ? match[1] : '';
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Shared validation + duplicate detection used by BOTH upload and ZIP paths.
 * Duplicates are reported, never silently discarded.
 */
export async function stageEntries(
  entries: ImportEntry[],
  existingHashes: Set<string>
): Promise<StagedItem[]> {
  const seen = new Set<string>();
  const out: StagedItem[] = [];
  for (const entry of entries) {
    const mime = IMAGE_MIME_BY_EXT[extensionOf(entry.filename)];
    if (!mime) {
      out.push({
        key: entry.key,
        filename: entry.filename,
        source: entry.source,
        zipPath: entry.zipPath,
        bytes: entry.bytes,
        status: 'unsupported',
        error: 'Unsupported file type. Only PNG, JPEG and WebP images can be imported.'
      });
      continue;
    }
    if (entry.bytes.length === 0) {
      out.push({
        key: entry.key,
        filename: entry.filename,
        source: entry.source,
        zipPath: entry.zipPath,
        bytes: entry.bytes,
        status: 'invalid',
        error: 'The file is empty or could not be read.'
      });
      continue;
    }
    if (entry.bytes.length > MAX_SIZE_BYTES) {
      out.push({
        key: entry.key,
        filename: entry.filename,
        source: entry.source,
        zipPath: entry.zipPath,
        bytes: entry.bytes,
        status: 'invalid',
        error: `File is too large (${(entry.bytes.length / 1024 / 1024).toFixed(1)} MB).`
      });
      continue;
    }
    const sha = await sha256Hex(entry.bytes);
    if (existingHashes.has(sha) || seen.has(sha)) {
      out.push({
        key: entry.key,
        filename: entry.filename,
        source: entry.source,
        zipPath: entry.zipPath,
        bytes: entry.bytes,
        status: 'duplicate',
        sha256: sha,
        error: 'An identical image is already in this project (or was imported twice in this batch).'
      });
      continue;
    }
    seen.add(sha);
    out.push({
      key: entry.key,
      filename: entry.filename,
      source: entry.source,
      zipPath: entry.zipPath,
      bytes: entry.bytes,
      status: 'valid',
      mime,
      sha256: sha,
      warning:
        entry.bytes.length > WARN_SIZE_BYTES
          ? `Large file (${(entry.bytes.length / 1024 / 1024).toFixed(1)} MB) — import will use more memory.`
          : undefined
    });
  }
  return out;
}

export interface AssetRepo {
  addAsset: (asset: ImageAsset, blob: Blob) => Promise<void>;
}

/**
 * Persist staged items as image assets, processing in batches and yielding
 * to the event loop so the UI never freezes on large imports.
 */
export async function commitStagedItems(
  items: StagedItem[],
  projectId: string,
  repo: AssetRepo,
  options: {
    isCancelled?: () => boolean;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<ImageAsset[]> {
  const now = Date.now();
  const created: ImageAsset[] = [];
  for (let i = 0; i < items.length; i++) {
    if (options.isCancelled?.()) break;
    const item = items[i];
    if (item.status !== 'valid' || !item.sha256 || !item.mime) continue;
    const blob = new Blob([new Uint8Array(item.bytes)], { type: item.mime });
    const asset: ImageAsset = {
      id: crypto.randomUUID(),
      projectId,
      blobKey: crypto.randomUUID(),
      filename: item.filename,
      mime: item.mime,
      widthPx: item.widthPx ?? 0,
      heightPx: item.heightPx ?? 0,
      sha256: item.sha256,
      createdAt: now
    };
    await repo.addAsset(asset, blob);
    created.push(asset);
    options.onProgress?.(i + 1, items.length);
    if ((i + 1) % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return created;
}
