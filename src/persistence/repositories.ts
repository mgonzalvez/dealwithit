import { db, ThumbnailRecord } from './db';
import {
  CardDefinition,
  DeckDefinition,
  ImageAsset,
  Project,
  SCHEMA_VERSION,
  TableState
} from '../domain/models';
import { ProjectData } from '../features/export/export';

export async function createProject(name: string, description?: string): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
  await db.projects.add(project);
  return project;
}

export async function touchProject(projectId: string): Promise<void> {
  await db.projects.update(projectId, { updatedAt: Date.now() });
}

export function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export function getProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId);
}

export async function saveImageAsset(asset: ImageAsset, blob: Blob): Promise<void> {
  await db.assetBlobs.put({ blobKey: asset.blobKey, blob });
  await db.imageAssets.add(asset);
}

export function listImageAssets(projectId: string): Promise<ImageAsset[]> {
  return db.imageAssets.where('projectId').equals(projectId).toArray();
}

export async function getImageBlob(assetId: string): Promise<Blob | undefined> {
  const asset = await db.imageAssets.get(assetId);
  if (!asset) return undefined;
  const record = await db.assetBlobs.get(asset.blobKey);
  return record?.blob;
}

export async function saveCardDefinition(card: CardDefinition): Promise<void> {
  await db.cardDefinitions.put(card);
}

export function listCardDefinitions(projectId: string): Promise<CardDefinition[]> {
  return db.cardDefinitions.where('projectId').equals(projectId).toArray();
}

export async function saveDeck(deck: DeckDefinition): Promise<void> {
  await db.deckDefinitions.put(deck);
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.deckDefinitions.delete(deckId);
}

export async function deleteCardDefinition(cardId: string): Promise<void> {
  await db.cardDefinitions.delete(cardId);
}

export function listDecks(projectId: string): Promise<DeckDefinition[]> {
  return db.deckDefinitions.where('projectId').equals(projectId).toArray();
}

export async function saveTable(table: TableState): Promise<void> {
  await db.tableStates.put(table);
}

export function listTables(projectId: string): Promise<TableState[]> {
  return db.tableStates.where('projectId').equals(projectId).toArray();
}

export async function saveThumbnail(record: ThumbnailRecord): Promise<void> {
  await db.thumbnails.put(record);
}

export function listThumbnails(projectId: string): Promise<ThumbnailRecord[]> {
  return db.thumbnails.where('projectId').equals(projectId).toArray();
}

export async function ensureCardFromAsset(
  projectId: string,
  assetId: string,
  name: string
): Promise<CardDefinition> {
  const existing = await db.cardDefinitions
    .filter((card) => card.projectId === projectId && card.frontAssetId === assetId)
    .first();
  if (existing) return existing;
  const card: CardDefinition = {
    id: crypto.randomUUID(),
    projectId,
    name,
    frontAssetId: assetId,
    frontTransform: { rotationDeg: 0, scale: 1, offsetX: 0, offsetY: 0, fit: 'contain' },
    widthMm: 63.5,
    heightMm: 88.9,
    tags: []
  };
  await db.cardDefinitions.add(card);
  return card;
}

export async function loadProjectData(projectId: string): Promise<ProjectData | null> {
  const project = await db.projects.get(projectId);
  if (!project) return null;
  const assets = await db.imageAssets.where('projectId').equals(projectId).toArray();
  const cards = await db.cardDefinitions.where('projectId').equals(projectId).toArray();
  const decks = await db.deckDefinitions.where('projectId').equals(projectId).toArray();
  const tables = await db.tableStates.where('projectId').equals(projectId).toArray();
  const blobs = new Map<string, Blob>();
  for (const asset of assets) {
    const record = await db.assetBlobs.get(asset.blobKey);
    if (record) blobs.set(asset.blobKey, record.blob);
  }
  return { project, assets, blobs, cards, decks, tables };
}

export async function saveProjectData(data: ProjectData): Promise<void> {
  await db.projects.add(data.project);
  for (const asset of data.assets) {
    const blob = data.blobs.get(asset.blobKey);
    if (blob) await db.assetBlobs.put({ blobKey: asset.blobKey, blob });
  }
  for (const card of data.cards) await db.cardDefinitions.put(card);
  for (const deck of data.decks) await db.deckDefinitions.put(deck);
  for (const table of data.tables) await db.tableStates.put(table);
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}
