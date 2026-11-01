import { db } from './db';
import {
  CardDefinition,
  DeckDefinition,
  ImageAsset,
  Project,
  SCHEMA_VERSION,
  TableState
} from '../domain/models';

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

export function listDecks(projectId: string): Promise<DeckDefinition[]> {
  return db.deckDefinitions.where('projectId').equals(projectId).toArray();
}

export async function saveTable(table: TableState): Promise<void> {
  await db.tableStates.put(table);
}

export function listTables(projectId: string): Promise<TableState[]> {
  return db.tableStates.where('projectId').equals(projectId).toArray();
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}
