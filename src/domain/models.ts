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
export const TABLE_WIDTH = 1600;
export const TABLE_HEIGHT = 1000;
