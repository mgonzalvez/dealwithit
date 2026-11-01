import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildProjectZip, readProjectZip, exportFilename } from '../features/export/export';
import { ProjectData } from '../features/export/export';
import { makePng } from './fixtures/png';

function makeProjectData(): ProjectData {
  const now = Date.now();
  const pngA = makePng(10, 15, [200, 50, 50]);
  const pngB = makePng(8, 8, [50, 200, 50]);
  const blobA = new Blob([new Uint8Array(pngA)], { type: 'image/png' });
  const blobB = new Blob([new Uint8Array(pngB)], { type: 'image/png' });
  const assetA = {
    id: 'asset-a',
    projectId: 'proj-1',
    blobKey: 'blob-a',
    filename: 'front.png',
    mime: 'image/png' as const,
    widthPx: 10,
    heightPx: 15,
    sha256: 'placeholder',
    createdAt: now
  };
  const assetB = {
    id: 'asset-b',
    projectId: 'proj-1',
    blobKey: 'blob-b',
    filename: 'back.png',
    mime: 'image/png' as const,
    widthPx: 8,
    heightPx: 8,
    sha256: 'placeholder',
    createdAt: now
  };
  const card = {
    id: 'card-1',
    projectId: 'proj-1',
    name: 'Hero',
    frontAssetId: 'asset-a',
    backAssetId: 'asset-b',
    frontTransform: { rotationDeg: 90 as const, scale: 1.2, offsetX: 3, offsetY: -2, fit: 'cover' as const },
    widthMm: 63.5,
    heightMm: 88.9,
    tags: ['test']
  };
  const deck = {
    id: 'deck-1',
    projectId: 'proj-1',
    name: 'Main Deck',
    entries: [{ id: 'entry-1', cardDefinitionId: 'card-1', quantity: 4 }],
    defaultBackAssetId: 'asset-b',
    createdAt: now,
    updatedAt: now
  };
  const table = {
    id: 'table-1',
    projectId: 'proj-1',
    name: 'Main table',
    objects: [
      {
        id: 'obj-1',
        type: 'stack' as const,
        x: 800,
        y: 500,
        z: 0,
        rotationDeg: 0,
        cardInstances: [
          { instanceId: 'i1', cardDefinitionId: 'card-1', face: 'back' as const, rotationDeg: 0 },
          { instanceId: 'i2', cardDefinitionId: 'card-1', face: 'front' as const, rotationDeg: 90 }
        ],
        label: 'Main Deck',
        sourceDeckId: 'deck-1'
      }
    ],
    camera: { x: 12, y: 34, zoom: 0.8 },
    background: '#2f4858',
    updatedAt: now
  };
  return {
    project: {
      id: 'proj-1',
      name: 'Round Trip Game',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now
    },
    assets: [assetA, assetB],
    blobs: new Map<string, Blob>([['blob-a', blobA], ['blob-b', blobB]]),
    cards: [card],
    decks: [deck],
    tables: [table]
  };
}

describe('project export/import round trip', () => {
  it('exportFilename is safe and uses .dealwithit.zip', () => {
    expect(exportFilename('My Cool Game!')).toBe('My-Cool-Game.dealwithit.zip');
    expect(exportFilename('***')).toBe('project.dealwithit.zip');
  });

  it('round-trips a project with assets, decks, cards and table state', async () => {
    const original = makeProjectData();
    const zipBuffer = await buildProjectZip(original);
    const result = await readProjectZip(zipBuffer);

    expect(result.errors).toEqual([]);
    expect(result.data).not.toBeNull();
    const imported = result.data!;

    // IDs are remapped, so nothing collides with the original project.
    expect(imported.project.id).not.toBe(original.project.id);
    expect(imported.project.name).toBe('Round Trip Game');

    // Every asset survives with its bytes intact.
    expect(imported.assets.length).toBe(2);
    const origBytes = new Uint8Array(await original.blobs.get('blob-a')!.arrayBuffer());
    const importedBytes = new Uint8Array(await imported.blobs.get(imported.assets[0].blobKey)!.arrayBuffer());
    expect(Array.from(importedBytes)).toEqual(Array.from(origBytes));

    // References are rewritten consistently.
    const card = imported.cards[0];
    expect(imported.assets.some((a) => a.id === card.frontAssetId)).toBe(true);
    expect(imported.assets.some((a) => a.id === card.backAssetId)).toBe(true);
    expect(imported.cards[0].frontTransform).toEqual({ rotationDeg: 90, scale: 1.2, offsetX: 3, offsetY: -2, fit: 'cover' });

    // Deck counts match.
    expect(imported.decks[0].entries[0].quantity).toBe(4);
    expect(imported.decks[0].entries[0].cardDefinitionId).toBe(card.id);
    expect(imported.decks[0].defaultBackAssetId).toBe(card.backAssetId);

    // Table state resumes exactly: position, camera, faces, rotations.
    const table = imported.tables[0];
    expect(table.objects[0].x).toBe(800);
    expect(table.camera.zoom).toBe(0.8);
    expect(table.background).toBe('#2f4858');
    expect(table.objects[0].cardInstances[1].face).toBe('front');
    expect(table.objects[0].cardInstances[1].rotationDeg).toBe(90);
  });

  it('rejects a plain image ZIP with a helpful message', async () => {
    const zip = new JSZip();
    zip.file('card1.png', makePng(2, 2, [1, 1, 1]));
    const buffer = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    const result = await readProjectZip(buffer);
    expect(result.data).toBeNull();
    expect(result.errors[0]).toMatch(/Workshop/);
  });

  it('rejects a damaged archive whose checksum does not match', async () => {
    const zipBuffer = await buildProjectZip(makeProjectData());
    // Tamper with one asset's bytes while keeping the manifest checksum.
    const zip = await JSZip.loadAsync(zipBuffer);
    const assetPath = Object.keys(zip.files).find((name) => name.startsWith('assets/') && !zip.files[name].dir)!;
    zip.file(assetPath, new Uint8Array([1, 2, 3, 4, 5]));
    const tampered = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    const result = await readProjectZip(tampered);
    expect(result.data).toBeNull();
    expect(result.errors.some((e) => /checksum mismatch/i.test(e))).toBe(true);
  });

  it('rejects a project from a future schema version', async () => {
    const data = makeProjectData();
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'dealwithit-project',
        version: 1,
        schemaVersion: 99,
        project: data.project,
        assets: [],
        cardDefinitions: [],
        deckDefinitions: [],
        tables: []
      })
    );
    const buffer = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    const result = await readProjectZip(buffer);
    expect(result.data).toBeNull();
    expect(result.errors[0]).toMatch(/newer than this app supports/);
  });

  it('rejects broken card references instead of importing half a project', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'dealwithit-project',
        version: 1,
        schemaVersion: 1,
        project: { id: 'p', name: 'Broken', schemaVersion: 1, createdAt: 1, updatedAt: 2 },
        assets: [],
        cardDefinitions: [
          {
            id: 'c1',
            projectId: 'p',
            name: 'Ghost card',
            frontAssetId: 'missing-asset',
            frontTransform: { rotationDeg: 0, scale: 1, offsetX: 0, offsetY: 0, fit: 'contain' },
            widthMm: 63.5,
            heightMm: 88.9,
            tags: []
          }
        ],
        deckDefinitions: [],
        tables: []
      })
    );
    const buffer = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    const result = await readProjectZip(buffer);
    expect(result.data).toBeNull();
    expect(result.errors.some((e) => /missing image/i.test(e))).toBe(true);
  });
});
