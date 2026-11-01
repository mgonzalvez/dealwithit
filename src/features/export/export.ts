import JSZip from 'jszip';
import {
  CardDefinition,
  DeckDefinition,
  ImageAsset,
  Project,
  TableState
} from '../../domain/models';
import { projectSchema } from '../../domain/schemas';
import { assertSupportedSchemaVersion } from '../../persistence/migrations';
import { sha256Hex } from '../import/pipeline';
import { isSafeArchivePath } from '../import/zip-safety';

export const EXPORT_FORMAT = 'dealwithit-project';
export const EXPORT_VERSION = 1;

export interface ProjectData {
  project: Project;
  assets: ImageAsset[];
  blobs: Map<string, Blob>; // keyed by blobKey
  cards: CardDefinition[];
  decks: DeckDefinition[];
  tables: TableState[];
}

interface ManifestAssetEntry {
  asset: ImageAsset;
  path: string;
  sha256: string;
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  return 'webp';
}

export function exportFilename(projectName: string): string {
  const safe = projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'project';
  return `${safe}.dealwithit.zip`;
}

/**
 * Build a self-contained, reproducible project archive:
 * manifest.json + every referenced original image in assets/<id>.<ext>.
 * No external URLs are needed to resume play.
 */
export async function buildProjectZip(data: ProjectData): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const manifestAssets: ManifestAssetEntry[] = [];

  for (const asset of data.assets) {
    const blob = data.blobs.get(asset.blobKey);
    if (!blob) {
      throw new Error(`Missing stored image for "${asset.filename}".`);
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const path = `assets/${asset.id}.${extensionForMime(asset.mime)}`;
    zip.file(path, bytes);
    manifestAssets.push({ asset, path, sha256 });
  }

  const manifest = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    schemaVersion: data.project.schemaVersion,
    exportedAt: Date.now(),
    project: data.project,
    assets: manifestAssets,
    cardDefinitions: data.cards,
    deckDefinitions: data.decks,
    tables: data.tables
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'arraybuffer' });
}

export interface ProjectImportResult {
  data: ProjectData | null;
  errors: string[];
  info: string[];
}

/**
 * Validate and read a .dealwithit.zip archive. IDs are remapped on import so
 * projects can be imported repeatedly without collisions. Unsafe paths,
 * damaged checksums and broken references are rejected with clear messages.
 */
export async function readProjectZip(buffer: ArrayBuffer): Promise<ProjectImportResult> {
  const errors: string[] = [];
  const info: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { data: null, errors: ['This file could not be read as a ZIP archive.'], info };
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    return {
      data: null,
      errors: [
        'This ZIP does not contain a manifest.json. To add card images, use "Import ZIP" in the Workshop instead.'
      ],
      info
    };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(await manifestFile.async('text'));
  } catch {
    return { data: null, errors: ['manifest.json is not valid JSON.'], info };
  }

  const raw = manifest as Record<string, unknown>;
  if (raw.format !== EXPORT_FORMAT) {
    if (raw.format === 'dealwithit-import') {
      return {
        data: null,
        errors: ['This is an image-import manifest. Use "Import ZIP" in the Workshop for that file.'],
        info
      };
    }
    return { data: null, errors: [`Unsupported archive format: ${String(raw.format ?? 'unknown')}.`], info };
  }
  if (raw.version !== EXPORT_VERSION) {
    errors.push(`Unsupported export version ${String(raw.version)}.`);
  }

  const projectCheck = projectSchema.safeParse(raw.project);
  if (!projectCheck.success) {
    errors.push('The project data in the archive is invalid.');
  }
  try {
    assertSupportedSchemaVersion(Number(raw.schemaVersion ?? 1));
  } catch (error) {
    errors.push((error as Error).message);
  }
  if (errors.length > 0) return { data: null, errors, info };

  const sourceProject = raw.project as Project;

  // Collision-safe ID remapping.
  const idMap = new Map<string, string>();
  const newId = (old: string): string => {
    const existing = idMap.get(old);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    idMap.set(old, fresh);
    return fresh;
  };

  const project: Project = {
    ...sourceProject,
    id: newId(sourceProject.id),
    updatedAt: Date.now()
  };

  const assets: ImageAsset[] = [];
  const blobs = new Map<string, Blob>();
  const assetIds = new Set<string>();

  const manifestAssets = (raw.assets ?? []) as ManifestAssetEntry[];
  for (const entry of manifestAssets) {
    if (!isSafeArchivePath(entry.path)) {
      errors.push(`Rejected unsafe archive path: ${entry.path}`);
      continue;
    }
    const file = zip.file(entry.path);
    if (!file) {
      errors.push(`Missing image file in the archive: ${entry.path}`);
      continue;
    }
    const bytes = new Uint8Array(await file.async('uint8array'));
    const sha256 = await sha256Hex(bytes);
    if (sha256 !== entry.sha256) {
      errors.push(`Checksum mismatch for ${entry.asset.filename}. The archive may be damaged.`);
      continue;
    }
    const id = newId(entry.asset.id);
    const blobKey = crypto.randomUUID();
    assetIds.add(id);
    assets.push({ ...entry.asset, id, projectId: project.id, blobKey });
    blobs.set(blobKey, new Blob([bytes], { type: entry.asset.mime }));
  }

  const cards: CardDefinition[] = [];
  for (const card of (raw.cardDefinitions ?? []) as CardDefinition[]) {
    const frontId = newId(card.frontAssetId);
    if (!assetIds.has(frontId)) {
      errors.push(`Card "${card.name}" references a missing image.`);
      continue;
    }
    cards.push({
      ...card,
      id: newId(card.id),
      projectId: project.id,
      frontAssetId: frontId,
      backAssetId: card.backAssetId ? newId(card.backAssetId) : undefined
    });
  }

  const cardIds = new Set(cards.map((card) => card.id));
  const decks: DeckDefinition[] = [];
  for (const deck of (raw.deckDefinitions ?? []) as DeckDefinition[]) {
    const entries = (deck.entries ?? []).filter((entry) => cardIds.has(newId(entry.cardDefinitionId)));
    if (entries.length < (deck.entries?.length ?? 0)) {
      info.push(`Deck "${deck.name}": dropped entries whose cards are missing.`);
    }
    decks.push({
      ...deck,
      id: newId(deck.id),
      projectId: project.id,
      entries: entries.map((entry) => ({
        id: crypto.randomUUID(),
        cardDefinitionId: newId(entry.cardDefinitionId),
        quantity: entry.quantity
      })),
      defaultBackAssetId: deck.defaultBackAssetId ? newId(deck.defaultBackAssetId) : undefined
    });
  }

  const tables: TableState[] = [];
  for (const table of (raw.tables ?? []) as TableState[]) {
    const objects = (table.objects ?? []).filter((object) =>
      object.cardInstances.every((instance) => cardIds.has(newId(instance.cardDefinitionId)))
    );
    tables.push({
      ...table,
      id: newId(table.id),
      projectId: project.id,
      objects: objects.map((object) => ({
        ...object,
        id: crypto.randomUUID(),
        cardInstances: object.cardInstances.map((instance) => ({
          ...instance,
          instanceId: crypto.randomUUID(),
          cardDefinitionId: newId(instance.cardDefinitionId)
        }))
      })),
      updatedAt: Date.now()
    });
  }

  if (errors.length > 0) return { data: null, errors, info };
  return { data: { project, assets, blobs, cards, decks, tables }, errors: [], info };
}
