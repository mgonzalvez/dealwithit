import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  commitStagedItems,
  stageEntries,
  ImportEntry,
  sha256Hex
} from '../features/import/pipeline';
import { parseImageZip, detectFrontBackPairing } from '../features/import/zipImport';
import { isSafeArchivePath, isIgnoredArchivePath } from '../features/import/zip-safety';
import { naturalCompare } from '../domain/natural-sort';
import { makePng } from './fixtures/png';
import { makeRawZip } from './fixtures/raw-zip';
import { ImageAsset } from '../domain/models';

function upload(name: string, bytes: Uint8Array): ImportEntry {
  return { key: `upload:${name}`, filename: name, source: 'upload', bytes };
}

describe('path safety', () => {
  it('rejects zip-slip and absolute paths', () => {
    expect(isSafeArchivePath('fronts/a.png')).toBe(true);
    expect(isSafeArchivePath('../evil.png')).toBe(false);
    expect(isSafeArchivePath('/etc/passwd')).toBe(false);
    expect(isSafeArchivePath('a/../../b.png')).toBe(false);
  });

  it('ignores OS metadata files', () => {
    expect(isIgnoredArchivePath('__MACOSX/fronts/._a.png')).toBe(true);
    expect(isIgnoredArchivePath('fronts/.DS_Store')).toBe(true);
    expect(isIgnoredArchivePath('fronts/a.png')).toBe(false);
  });
});

describe('natural sort', () => {
  it('orders numbers human-style', () => {
    const names = ['card 10.png', 'card 2.png', 'card 1.png', 'Card 100.png'];
    const sorted = [...names].sort(naturalCompare);
    expect(sorted).toEqual(['card 1.png', 'card 2.png', 'card 10.png', 'Card 100.png']);
  });
});

describe('stageEntries validation', () => {
  it('accepts a single PNG and records its hash', async () => {
    const png = makePng(4, 6, [200, 100, 50]);
    const items = await stageEntries([upload('single.png', png)], new Set());
    expect(items.length).toBe(1);
    expect(items[0].status).toBe('valid');
    expect(items[0].sha256).toBe(await sha256Hex(png));
  });

  it('reports unsupported files per file instead of crashing', async () => {
    const items = await stageEntries(
      [upload('notes.txt', new TextEncoder().encode('hello')), upload('ok.png', makePng(1, 1, [0, 0, 0]))],
      new Set()
    );
    expect(items[0].status).toBe('unsupported');
    expect(items[1].status).toBe('valid');
  });

  it('flags empty files as invalid', async () => {
    const items = await stageEntries([upload('empty.png', new Uint8Array([]))], new Set());
    expect(items[0].status).toBe('invalid');
  });

  it('detects duplicates with identical bytes but different filenames', async () => {
    const png = makePng(3, 3, [10, 20, 30]);
    const items = await stageEntries([upload('front.png', png), upload('alt-name.png', png)], new Set());
    expect(items[0].status).toBe('valid');
    expect(items[1].status).toBe('duplicate');
  });

  it('detects duplicates against the existing library', async () => {
    const png = makePng(2, 2, [1, 2, 3]);
    const existingHashes = new Set([await sha256Hex(png)]);
    const items = await stageEntries([upload('again.png', png)], existingHashes);
    expect(items[0].status).toBe('duplicate');
  });
});

describe('parseImageZip', () => {
  it('handles a corrupt ZIP gracefully', async () => {
    const result = await parseImageZip(new TextEncoder().encode('this is not a zip').buffer as ArrayBuffer);
    expect(result.entries.length).toBe(0);
    expect(result.errors[0]).toMatch(/could not be read as a ZIP/i);
  });

  it('imports flat and nested image ZIPs, ignoring OS metadata', async () => {
    const zip = new JSZip();
    zip.file('card1.png', makePng(10, 10, [255, 0, 0]));
    zip.file('nested/card2.png', makePng(10, 10, [0, 255, 0]));
    zip.file('.DS_Store', 'junk');
    zip.file('__MACOSX/._card1.png', 'junk');
    zip.file('readme.txt', 'not an image');
    const result = await parseImageZip((await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer);
    expect(result.entries.length).toBe(3); // 2 images + readme.txt (reported by pipeline)
    const staged = await stageEntries(result.entries, new Set());
    expect(staged.filter((s) => s.status === 'valid').length).toBe(2);
    expect(staged.filter((s) => s.status === 'unsupported').length).toBe(1);
  });

  it('never accepts unsafe paths even after archive-reader normalization', async () => {
    // JSZip normalizes '../' away when loading, so a malicious raw archive
    // arrives here as a plain name. Our own guard is a second, independent
    // layer: any entry whose path still contains '..' is rejected.
    const result = await parseImageZip(makeRawZip([
      { name: 'a/../evil.png', data: makePng(1, 1, [0, 0, 0]) },
      { name: 'good.png', data: makePng(2, 2, [1, 1, 1]) }
    ]));
    // No entry may survive with an unsafe path.
    expect(result.entries.every((e) => isSafeArchivePath(e.zipPath ?? e.filename))).toBe(true);
    expect(result.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('corrupt archives produce a clear error, never a crash', async () => {
    const result = await parseImageZip(new Uint8Array([1, 2, 3, 4, 5]).buffer as ArrayBuffer);
    expect(result.entries.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects a shared back in Card Extractor-style archives', async () => {
    const zip = new JSZip();
    zip.file('fronts/a.png', makePng(5, 5, [1, 2, 3]));
    zip.file('fronts/b.png', makePng(5, 5, [4, 5, 6]));
    zip.file('backs/shared.png', makePng(5, 5, [7, 8, 9]));
    const result = await parseImageZip((await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer);
    expect(result.pairing.hasFrontsBacks).toBe(true);
    expect(result.pairing.sharedBack).toBe('backs/shared.png');
    expect(result.pairing.uncertain).toBe(false);
  });

  it('marks pairing uncertain when fronts have no matching backs', async () => {
    const zip = new JSZip();
    zip.file('fronts/a.png', makePng(5, 5, [1, 1, 1]));
    zip.file('fronts/b.png', makePng(5, 5, [2, 2, 2]));
    zip.file('backs/x.png', makePng(5, 5, [3, 3, 3]));
    zip.file('backs/y.png', makePng(5, 5, [4, 4, 4]));
    const result = await parseImageZip((await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer);
    expect(result.pairing.uncertain).toBe(true);
  });

  it('pairs matching stems when there are multiple backs', async () => {
    const zip = new JSZip();
    zip.file('fronts/dragon.png', makePng(5, 5, [1, 1, 1]));
    zip.file('fronts/elf.png', makePng(5, 5, [2, 2, 2]));
    zip.file('backs/dragon.png', makePng(5, 5, [3, 3, 3]));
    zip.file('backs/elf.png', makePng(5, 5, [4, 4, 4]));
    const result = await parseImageZip((await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer);
    expect(result.pairing.uncertain).toBe(false);
    const pairing = detectFrontBackPairing(result.entries);
    expect(Object.values(pairing.pairs).sort()).toEqual(['backs/dragon.png', 'backs/elf.png']);
  });
});

describe('M1 acceptance: mixed uploads and ZIPs in one project', () => {
  it('imports 1 + 100 + ZIP + 5 more, deduplicating on reload-equivalent hashes', async () => {
    const repoAssets = new Map<string, ImageAsset>();
    const repo = {
      addAsset: async (asset: ImageAsset, blob: Blob) => {
        repoAssets.set(asset.id, asset);
        void blob;
      }
    };
    const projectId = 'project-1';

    // 1) single PNG upload
    const first = makePng(20, 30, [10, 10, 10]);
    const staged1 = await stageEntries([upload('hero.png', first)], new Set());
    const created1 = await commitStagedItems(staged1, projectId, repo);
    expect(created1.length).toBe(1);

    // 2) 100 mixed images in one action
    const hundred: ImportEntry[] = [];
    for (let i = 0; i < 100; i++) {
      hundred.push(upload(`card ${i}.png`, makePng(8 + (i % 4), 12, [i % 256, (i * 2) % 256, (i * 3) % 256])));
    }
    const hashes2 = new Set([...repoAssets.values()].map((a) => a.sha256));
    const staged2 = await stageEntries(hundred, hashes2);
    const created2 = await commitStagedItems(staged2, projectId, repo);
    expect(created2.length).toBe(100);

    // 3) ZIP import (Card Extractor style)
    const zip = new JSZip();
    zip.file('fronts/front 1.png', makePng(9, 12, [20, 20, 20]));
    zip.file('fronts/front 2.png', makePng(9, 12, [30, 30, 30]));
    zip.file('backs/back.png', makePng(9, 12, [40, 40, 40]));
    const zipResult = await parseImageZip((await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer);
    const hashes3 = new Set([...repoAssets.values()].map((a) => a.sha256));
    const staged3 = await stageEntries(zipResult.entries, hashes3);
    const created3 = await commitStagedItems(staged3, projectId, repo);
    expect(created3.length).toBe(3);

    // 4) five more loose images, one of which is a byte-for-byte repeat of hero.png
    const extra: ImportEntry[] = [];
    for (let i = 0; i < 4; i++) extra.push(upload(`extra ${i}.png`, makePng(6, 6, [i, i, i])));
    extra.push(upload('hero-copy.png', first));
    const hashes4 = new Set([...repoAssets.values()].map((a) => a.sha256));
    const staged4 = await stageEntries(extra, hashes4);
    const created4 = await commitStagedItems(staged4, projectId, repo);
    expect(staged4.filter((s) => s.status === 'duplicate').length).toBe(1);
    expect(created4.length).toBe(4);

    // Total assets: 1 + 100 + 3 + 4 = 108 unique images.
    expect(repoAssets.size).toBe(108);
  });

  it('stops committing when the import is cancelled', async () => {
    const repoAssets = new Map<string, ImageAsset>();
    const repo = {
      addAsset: async (asset: ImageAsset, blob: Blob) => {
        repoAssets.set(asset.id, asset);
        void blob;
      }
    };
    let count = 0;
    const items = await stageEntries(
      Array.from({ length: 50 }, (_, i) => upload(`c${i}.png`, makePng(4, 4, [i, 0, 0]))),
      new Set()
    );
    const created = await commitStagedItems(items, 'p', repo, {
      isCancelled: () => count >= 5,
      onProgress: (done) => {
        void done;
        count++;
      }
    });
    expect(created.length).toBe(5);
  });
});
