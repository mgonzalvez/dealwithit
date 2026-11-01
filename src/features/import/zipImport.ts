import JSZip from 'jszip';
import { importManifestSchema } from '../../domain/schemas';
import { ImportEntry } from './pipeline';
import { isIgnoredArchivePath, isSafeArchivePath } from './zip-safety';
import { extractorCardIndex, isCardExtractorArchive } from '../../integration/card-extractor';

const MAX_ARCHIVE_ENTRIES = 2000;
const MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;

export interface PairingInfo {
  hasFrontsBacks: boolean;
  /** Where the archive shape came from. */
  source: 'card-extractor' | 'generic';
  /** A single shared back for all fronts. */
  sharedBack?: string;
  /** front entry key -> back archive path matches. */
  pairs: Record<string, string>;
  /** True when pairing is ambiguous and needs user review. */
  uncertain: boolean;
  frontCount: number;
  backCount: number;
}

export interface ZipParseResult {
  entries: ImportEntry[];
  errors: string[];
  manifest: unknown | null;
  pairing: PairingInfo;
}

function stemOf(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

export function detectFrontBackPairing(entries: ImportEntry[]): PairingInfo {
  const fronts = entries.filter((e) => /^fronts\//i.test(e.zipPath ?? ''));
  const backs = entries.filter((e) => /^backs\//i.test(e.zipPath ?? ''));
  const base: PairingInfo = {
    hasFrontsBacks: false,
    source: 'generic',
    pairs: {},
    uncertain: false,
    frontCount: fronts.length,
    backCount: backs.length
  };
  if (fronts.length === 0 || backs.length === 0) return base;

  const isExtractor = isCardExtractorArchive([fronts[0].zipPath ?? '', backs[0].zipPath ?? '']);

  if (backs.length === 1) {
    return {
      ...base,
      hasFrontsBacks: true,
      source: isExtractor ? 'card-extractor' : 'generic',
      sharedBack: backs[0].zipPath,
      uncertain: false
    };
  }

  const pairs: Record<string, string> = {};
  let uncertain = fronts.length !== backs.length;

  if (isExtractor) {
    // Card Extractor names files 001_front.png / 001_back.png: pair by index.
    const backByIndex = new Map<number, string>();
    for (const back of backs) {
      const index = extractorCardIndex(back.zipPath ?? '');
      if (index !== null) backByIndex.set(index, back.zipPath ?? back.filename);
    }
    for (const front of fronts) {
      const index = extractorCardIndex(front.zipPath ?? '');
      const match = index !== null ? backByIndex.get(index) : undefined;
      if (match) pairs[front.key] = match;
      else uncertain = true;
    }
    return { ...base, hasFrontsBacks: true, source: 'card-extractor', pairs, uncertain };
  }

  const backByStem = new Map<string, string>();
  for (const back of backs) backByStem.set(stemOf(back.filename), back.zipPath ?? back.filename);
  for (const front of fronts) {
    const match = backByStem.get(stemOf(front.filename));
    if (match) pairs[front.key] = match;
    else uncertain = true;
  }
  return { ...base, hasFrontsBacks: true, pairs, uncertain };
}

/**
 * Parse an image ZIP: plain flat/nested archives, or Card Extractor-style
 * archives with fronts/ and backs/ folders. A corrupt ZIP returns an error
 * message instead of crashing. Unsafe paths are rejected entry-by-entry.
 */
export async function parseImageZip(buffer: ArrayBuffer): Promise<ZipParseResult> {
  const errors: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return {
      entries: [],
      errors: ['This file could not be read as a ZIP archive. It may be corrupted or unsupported.'],
      manifest: null,
      pairing: { hasFrontsBacks: false, source: 'generic', pairs: {}, uncertain: false, frontCount: 0, backCount: 0 }
    };
  }

  const names = Object.keys(zip.files);
  if (names.length > MAX_ARCHIVE_ENTRIES) {
    errors.push(`Archive contains too many entries (${names.length}). Maximum is ${MAX_ARCHIVE_ENTRIES}.`);
    return { entries: [], errors, manifest: null, pairing: { hasFrontsBacks: false, source: 'generic', pairs: {}, uncertain: false, frontCount: 0, backCount: 0 } };
  }

  const entries: ImportEntry[] = [];
  let manifest: unknown | null = null;
  let totalBytes = 0;

  for (const name of names) {
    const file = zip.files[name];
    if (file.dir) continue;
    if (isIgnoredArchivePath(name)) continue;
    if (!isSafeArchivePath(name)) {
      errors.push(`Rejected unsafe archive path: ${name}`);
      continue;
    }
    if (name.toLowerCase() === 'manifest.json') {
      const text = await file.async('text');
      try {
        const parsed = JSON.parse(text);
        if (importManifestSchema.safeParse(parsed).success) {
          manifest = parsed;
        } else {
          errors.push('manifest.json is present but does not match the Deal With It import format. It will be ignored.');
        }
      } catch {
        errors.push('manifest.json is not valid JSON and will be ignored.');
      }
      continue;
    }
    const bytes = await file.async('uint8array');
    totalBytes += bytes.length;
    if (totalBytes > MAX_ARCHIVE_BYTES) {
      errors.push('Archive uncompressed size exceeds 300 MB. Import stopped.');
      break;
    }
    const filename = name.split('/').pop() ?? name;
    // Unsupported files are still staged so the pipeline reports them
    // per-file rather than silently dropping them.
    entries.push({ key: `zip:${name}`, filename, source: 'zip', zipPath: name, bytes });
  }

  return { entries, errors, manifest, pairing: detectFrontBackPairing(entries) };
}
