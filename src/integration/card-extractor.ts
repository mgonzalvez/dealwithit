/**
 * Card Extractor bridge (M6).
 *
 * Verified against the real Card Extractor source (https://extractor.gonzhome.us;
 * repo inspected locally at "websites/Card Extractor/app.js"). Its Export produces
 * a ZIP archive containing:
 *
 *   fronts/001_front.png, fronts/002_front.png, ...   (one per card, already
 *   cropped, rotated and resized by the extractor)
 *   backs/001_back.png, ...                            (unique backs only; the
 *   "single back" option writes exactly one shared 001_back.png)
 *
 * There is no manifest file in the current export. Deal With It recognises this
 * archive shape and pairs fronts with backs by the zero-padded numeric index
 * (001_front.png <-> 001_back.png), then applies the backs as card back images
 * when the import lands in a deck.
 *
 * A richer manifest contract (deck names, quantities) is a future enhancement
 * only if Card Extractor ever emits one; we never require it.
 */
export const CARD_EXTRACTOR_URL = 'https://extractor.gonzhome.us';

const EXTRACTOR_FRONT = /^fronts\/(\d+)_front\.[a-z0-9]+$/i;
const EXTRACTOR_BACK = /^backs\/(\d+)_back\.[a-z0-9]+$/i;

/** True when the archive matches the Card Extractor export shape. */
export function isCardExtractorArchive(zipPaths: string[]): boolean {
  return zipPaths.some((path) => EXTRACTOR_FRONT.test(path));
}

/** Numeric card index for an extractor front/back file, or null. */
export function extractorCardIndex(zipPath: string): number | null {
  const match = zipPath.match(EXTRACTOR_FRONT) ?? zipPath.match(EXTRACTOR_BACK);
  return match ? Number(match[1]) : null;
}
