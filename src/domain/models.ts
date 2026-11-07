import { GeneratedBack } from './back-designs';

export type ID = string;

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ImageAsset {
  id: ID;
  projectId: ID;
  blobKey: ID;
  filename: string;
  mime: ImageMime;
  widthPx: number;
  heightPx: number;
  sha256: string;
  createdAt: number;
}

export interface ImageTransform {
  rotationDeg: 0 | 90 | 180 | 270;
  scale: number;
  offsetX: number;
  offsetY: number;
  fit: 'contain' | 'cover';
}

export interface CardDefinition {
  id: ID;
  projectId: ID;
  name: string;
  frontAssetId: ID;
  backAssetId?: ID;
  frontTransform: ImageTransform;
  backTransform?: ImageTransform;
  /** Procedurally generated back. Mutually exclusive with backAssetId. */
  backDesign?: GeneratedBack;
  widthMm: number;
  heightMm: number;
  tags: string[];
}

export interface DeckEntry {
  id: ID;
  cardDefinitionId: ID;
  quantity: number;
}

export interface DeckDefinition {
  id: ID;
  projectId: ID;
  name: string;
  entries: DeckEntry[];
  defaultBackAssetId?: ID;
  defaultBackDesign?: GeneratedBack;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CardInstance {
  instanceId: ID;
  cardDefinitionId: ID;
  face: 'front' | 'back';
  rotationDeg: number;
}

export interface TableObject {
  id: ID;
  type: 'card' | 'stack';
  x: number;
  y: number;
  z: number;
  rotationDeg: number;
  cardInstances: CardInstance[];
  label?: string;
  sourceDeckId?: ID;
}

export interface TableState {
  id: ID;
  projectId: ID;
  name: string;
  objects: TableObject[];
  camera: { x: number; y: number; zoom: number };
  background: string;
  updatedAt: number;
}

export interface Project {
  id: ID;
  name: string;
  description?: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  activeTableId?: ID;
}

export const SCHEMA_VERSION = 1;

/**
 * The felt is endless: there is no visible edge, so cards can live anywhere.
 * TABLE_WIDTH / TABLE_HEIGHT are only the default working area (where a fresh
 * table starts), and WORLD_LIMIT keeps coordinates from drifting into the
 * absurd while still leaving room for a very large spread.
 */
export const TABLE_WIDTH = 1600;
export const TABLE_HEIGHT = 1000;
export const WORLD_LIMIT = 6000;

/** Keep a table position inside the working area without hard edges. */
export function clampWorld(value: number): number {
  return Math.min(WORLD_LIMIT, Math.max(-WORLD_LIMIT, value));
}
