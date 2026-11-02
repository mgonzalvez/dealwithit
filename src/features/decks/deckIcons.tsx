/**
 * Free deck icons reused from the Fractal Symbols board-game icon library
 * (Felix Thalin, https://fractalsymbols.com, CC BY 4.0) — the same set used
 * by TokenMaker. SVGs are normalized to `fill: currentColor` so they adapt
 * to the light/dark theme.
 */

import { useEffect, useState } from 'react';

export interface DeckIcon {
  id: string;
  label: string;
}

export const DECK_ICONS: DeckIcon[] = [
  { id: 'deck', label: 'Deck' },
  { id: 'draw', label: 'Draw' },
  { id: 'discard', label: 'Discard' },
  { id: 'shuffle', label: 'Shuffle' },
  { id: 'hand', label: 'Hand' },
  { id: 'exhaust', label: 'Exhaust' },
  { id: 'dice', label: 'Dice' },
  { id: 'bag', label: 'Bag' },
  { id: 'book', label: 'Book' },
  { id: 'coin', label: 'Coin' },
  { id: 'star', label: 'Star' },
  { id: 'token', label: 'Token' },
  { id: 'flask', label: 'Flask' },
  { id: 'axe', label: 'Axe' },
  { id: 'shield', label: 'Shield' },
  { id: 'skull', label: 'Skull' },
  { id: 'heart', label: 'Heart' },
  { id: 'fire', label: 'Fire' },
  { id: 'water', label: 'Water' },
  { id: 'arcane', label: 'Arcane' },
  { id: 'exchange', label: 'Exchange' },
  { id: 'castle', label: 'Castle' },
  { id: 'forest', label: 'Forest' },
  { id: 'mountain', label: 'Mountain' }
];

export function iconUrl(iconId: string): string {
  // BASE_URL reflects vite.config's resolved `base` in dev and prod builds,
  // so icons resolve correctly at `/`, `/dealwithit/`, or any subpath.
  const base = import.meta.env.BASE_URL || '/';
  return `${base}deck-icons/${iconId}.svg`;
}

const iconCache = new Map<string, string>();

/**
 * Renders a deck icon inline (SVG text with `fill: currentColor`) so it
 * inherits the theme color. Fetches each icon once and caches it.
 */
export function DeckIconGlyph({ iconId }: { iconId: string }) {
  const [svg, setSvg] = useState<string | null>(iconCache.get(iconId) ?? null);

  useEffect(() => {
    const cached = iconCache.get(iconId);
    if (cached) {
      setSvg(cached);
      return;
    }
    void fetch(iconUrl(iconId))
      .then((response) => response.text())
      .then((text) => {
        iconCache.set(iconId, text);
        setSvg(text);
      })
      .catch(() => setSvg(null));
  }, [iconId]);

  if (!svg) return <span className="deck-icon is-empty" aria-hidden="true" />;
  return <span className="deck-icon" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" />;
}
