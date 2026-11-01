/**
 * Card Extractor bridge — placeholder for M6.
 *
 * DO NOT invent integration behavior. Per the build spec, a direct bridge is
 * implemented only after inspecting the real Card Extractor repository and
 * its export contract (https://extractor.gonzhome.us).
 *
 * Until then, Deal With It imports:
 *  - loose PNG/JPEG/WebP images (single or multiple)
 *  - plain ZIPs of images (flat or nested)
 *  - Card Extractor-shaped ZIPs with `fronts/` and `backs/` folders, with a
 *    pairing-review step for ambiguous matches
 *
 * The documented future manifest contract (enhancement, not a requirement):
 *
 * {
 *   "format": "dealwithit-import",
 *   "version": 1,
 *   "title": "Example PnP Game",
 *   "cards": [
 *     { "id": "card-001", "front": "images/card-001.png",
 *       "back": "images/common-back.png", "quantity": 1, "deck": "Main Deck" }
 *   ]
 * }
 */

export const CARD_EXTRACTOR_URL = 'https://extractor.gonzhome.us';

export function isManifestPresent(entries: string[]): boolean {
  return entries.includes('manifest.json');
}
