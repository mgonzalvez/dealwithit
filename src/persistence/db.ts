import Dexie, { type Table } from 'dexie';
import {
  CardDefinition,
  DeckDefinition,
  ImageAsset,
  Project,
  TableState
} from '../domain/models';

interface BlobRecord {
  blobKey: string;
  blob: Blob;
}

interface ThumbnailRecord {
  assetId: string;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
}

interface SettingsRecord {
  key: string;
  value: unknown;
}

export class DealWithItDB extends Dexie {
  projects!: Table<Project, string>;
  imageAssets!: Table<ImageAsset, string>;
  assetBlobs!: Table<BlobRecord, string>;
  cardDefinitions!: Table<CardDefinition, string>;
  deckDefinitions!: Table<DeckDefinition, string>;
  tableStates!: Table<TableState, string>;
  thumbnails!: Table<ThumbnailRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('dealwithit');
    // Version 1 — initial schema. Future migrations add version(n).stores({...})
    // with an upgrade() function. First index field is the primary key.
    this.version(1).stores({
      projects: 'id, updatedAt',
      imageAssets: 'id, projectId, sha256',
      assetBlobs: 'blobKey',
      cardDefinitions: 'id, projectId',
      deckDefinitions: 'id, projectId',
      tableStates: 'id, projectId',
      thumbnails: 'assetId',
      settings: 'key'
    });
  }
}

export const db = new DealWithItDB();
