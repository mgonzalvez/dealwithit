import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseImageZip, detectFrontBackPairing } from '../features/import/zipImport';
import { isCardExtractorArchive, extractorCardIndex } from '../integration/card-extractor';
import { makePng } from './fixtures/png';

/**
 * M6 bridge tests. The archive shapes below are copied from the real Card
 * Extractor export code (app.js exportZip): fronts/NNN_front.png and
 * backs/NNN_back.png, backs deduplicated, deflate compression.
 */
async function buildExtractorZip(fronts: number, backs: number): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const frontsFolder = zip.folder('fronts');
  const backsFolder = zip.folder('backs');
  for (let i = 1; i <= fronts; i++) {
    frontsFolder!.file(String(i).padStart(3, '0') + '_front.png', makePng(10 + i, 10, [i * 20 % 256, 100, 150]));
  }
  for (let i = 1; i <= backs; i++) {
    backsFolder!.file(String(i).padStart(3, '0') + '_back.png', makePng(12, 12, [50, 50 + i * 30, 90]));
  }
  return (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
}

describe('Card Extractor bridge', () => {
  it('recognises the Card Extractor archive shape', () => {
    expect(isCardExtractorArchive(['fronts/001_front.png', 'backs/001_back.png'])).toBe(true);
    expect(isCardExtractorArchive(['cards/a.png'])).toBe(false);
    // Fronts-only exports (no back cards in the PDF) are still extractor output.
    expect(isCardExtractorArchive(['fronts/007_front.png'])).toBe(true);
  });

  it('extracts the numeric card index from front and back names', () => {
    expect(extractorCardIndex('fronts/012_front.png')).toBe(12);
    expect(extractorCardIndex('backs/012_back.png')).toBe(12);
    expect(extractorCardIndex('random.png')).toBeNull();
  });

  it('pairs fronts with backs by numeric index (multiple backs)', async () => {
    const buffer = await buildExtractorZip(3, 3);
    const result = await parseImageZip(buffer);
    expect(result.errors).toHaveLength(0);
    expect(result.pairing.source).toBe('card-extractor');
    expect(result.pairing.hasFrontsBacks).toBe(true);
    expect(result.pairing.uncertain).toBe(false);
    expect(result.pairing.pairs['zip:fronts/001_front.png']).toBe('backs/001_back.png');
    expect(result.pairing.pairs['zip:fronts/002_front.png']).toBe('backs/002_back.png');
    expect(result.pairing.pairs['zip:fronts/003_front.png']).toBe('backs/003_back.png');
  });

  it('treats a single back as the shared back (singleBack toggle output)', async () => {
    const buffer = await buildExtractorZip(4, 1);
    const result = await parseImageZip(buffer);
    expect(result.pairing.sharedBack).toBe('backs/001_back.png');
    expect(result.pairing.uncertain).toBe(false);
    expect(result.pairing.frontCount).toBe(4);
    expect(result.pairing.backCount).toBe(1);
  });

  it('flags uncertainty when front and back counts disagree', async () => {
    const buffer = await buildExtractorZip(3, 2);
    const result = await parseImageZip(buffer);
    expect(result.pairing.uncertain).toBe(true);
    expect(result.pairing.source).toBe('card-extractor');
  });

  it('generic archives with fronts/backs folders still pair by stem', () => {
    const pairing = detectFrontBackPairing([
      { key: 'zip:fronts/ace.png', filename: 'ace.png', source: 'zip', zipPath: 'fronts/ace.png', bytes: new Uint8Array() },
      { key: 'zip:fronts/king.png', filename: 'king.png', source: 'zip', zipPath: 'fronts/king.png', bytes: new Uint8Array() },
      { key: 'zip:backs/ace.png', filename: 'ace.png', source: 'zip', zipPath: 'backs/ace.png', bytes: new Uint8Array() },
      { key: 'zip:backs/king.png', filename: 'king.png', source: 'zip', zipPath: 'backs/king.png', bytes: new Uint8Array() }
    ]);
    expect(pairing.source).toBe('generic');
    expect(pairing.pairs['zip:fronts/ace.png']).toBe('backs/ace.png');
    expect(pairing.pairs['zip:fronts/king.png']).toBe('backs/king.png');
    expect(pairing.uncertain).toBe(false);
  });
});
