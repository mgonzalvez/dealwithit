/**
 * Procedural card backs.
 *
 * A back is a small JSON design (style + colors + optional game name), not an
 * image. Geometry comes from a seeded PRNG, so the same design always renders
 * identically — in the app, in exports, and in tests.
 */
import { CardDefinition, DeckDefinition } from './models';

export type BackPatternId = 'diamonds' | 'lattice' | 'circles' | 'waves' | 'dots' | 'plain';

export interface GeneratedBack {
  seed: number;
  pattern: BackPatternId;
  base: string;
  ink: string;
  accent: string;
  title: string;
  showTitle: boolean;
  border: number; // 0..1
}

export interface BackStyle {
  id: BackPatternId;
  label: string;
  hint: string;
}

/** Step 1 of the wizard: pick a style. */
export const BACK_STYLES: BackStyle[] = [
  { id: 'diamonds', label: 'Classic diamonds', hint: 'Traditional playing-card lattice' },
  { id: 'lattice', label: 'Crosshatch', hint: 'Diagonal woven lines' },
  { id: 'circles', label: 'Ring pattern', hint: 'Repeated circles, elegant' },
  { id: 'waves', label: 'Waves', hint: 'Flowing bands' },
  { id: 'dots', label: 'Polka dots', hint: 'Simple, playful' },
  { id: 'plain', label: 'Solid colour', hint: 'Clean and minimal' }
];

/** Step 2 of the wizard: pick a colour. Accent is derived from the ink. */
export interface BackColor {
  label: string;
  base: string;
  ink: string;
}

export const BACK_COLORS: BackColor[] = [
  { label: 'Crimson', base: '#2b1a1c', ink: '#c23b43' },
  { label: 'Midnight', base: '#141c2b', ink: '#4f7dd0' },
  { label: 'Forest', base: '#173025', ink: '#59b08a' },
  { label: 'Cream', base: '#f6f1e7', ink: '#7a5a2f' },
  { label: 'Teal', base: '#103137', ink: '#3fb0a5' },
  { label: 'Violet', base: '#241d3a', ink: '#8f6ce0' },
  { label: 'Slate', base: '#e7ecf1', ink: '#334155' },
  { label: 'Mustard', base: '#2a2113', ink: '#e0a33d' }
];

/* ------------------------------------------------------------------ colors */

const HEX = /^#?[0-9a-f]{6}$/i;

export function normalizeHex(hex: string, fallback: string): string {
  if (!HEX.test(hex)) return fallback;
  const clean = hex.trim().toLowerCase();
  return clean.startsWith('#') ? clean : `#${clean}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const va = (pa >> (shift * 8)) & 0xff;
    const vb = (pb >> (shift * 8)) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[2, 1, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

export function deriveAccent(ink: string, base: string): string {
  return mixHex(ink, base, 0.45);
}

/* -------------------------------------------------------------------- RNG */

/** mulberry32 — small, fast, deterministic. */
export function seededRandom(seed: number): () => number {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = (t ^ (t >>> 30)) >>> 0;
    t = (t * 0x85ebca6b) >>> 0;
    t = (t ^ (t >>> 13)) >>> 0;
    return ((t * 0xc49e8d66) >>> 0) / 0x100000000;
  };
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

/* -------------------------------------------------------------- design build */

export function makeBackDesign(partial: Partial<GeneratedBack> = {}): GeneratedBack {
  const seed = partial.seed ?? randomSeed();
  const color = partial.base && partial.ink
    ? { base: partial.base, ink: partial.ink }
    : BACK_COLORS[seed % BACK_COLORS.length];
  const base = normalizeHex(color.base, '#141c2b');
  const ink = normalizeHex(color.ink, '#4f7dd0');
  const pattern: BackPatternId = partial.pattern ?? BACK_STYLES[seed % BACK_STYLES.length].id;
  return {
    seed,
    pattern,
    base,
    ink,
    accent: normalizeHex(partial.accent ?? deriveAccent(ink, base), deriveAccent(ink, base)),
    title: (partial.title ?? '').slice(0, 60),
    showTitle: partial.showTitle ?? Boolean(partial.title),
    border: Math.min(1, Math.max(0, partial.border ?? 0.7))
  };
}

/** Same style/colour, different random arrangement. */
export function reshuffleBack(design: GeneratedBack): GeneratedBack {
  return { ...design, seed: randomSeed() };
}

/* -------------------------------------------------------------- geometry */

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; width?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { kind: 'path'; points: number[]; stroke: string; width: number }
  | { kind: 'poly'; points: number[]; fill: string }
  | { kind: 'text'; text: string; cx: number; cy: number; size: number; color: string; rotateDeg: number };

/**
 * Pattern geometry for a card of the given pixel size, generated from the
 * design seed. Pure: no canvas, no randomness outside the seed.
 */
export function generateBackGeometry(design: GeneratedBack, width: number, height: number): Shape[] {
  const shapes: Shape[] = [];
  const rng = seededRandom(design.seed);
  const { ink, accent } = design;
  const min = Math.min(width, height);

  const frame = min * 0.04 * design.border;
  const inset = frame + min * 0.03;
  const innerW = Math.max(1, width - inset * 2);
  const innerH = Math.max(1, height - inset * 2);

  // Double frame — the classic playing-card border, and the fallback for 'plain'.
  if (design.border > 0) {
    const t = Math.max(1, min * 0.012 * design.border);
    shapes.push({ kind: 'rect', x: frame, y: frame, w: width - frame * 2, h: t, fill: ink });
    shapes.push({ kind: 'rect', x: frame, y: height - frame - t, w: width - frame * 2, h: t, fill: ink });
    shapes.push({ kind: 'rect', x: frame, y: frame, w: t, h: height - frame * 2, fill: ink });
    shapes.push({ kind: 'rect', x: width - frame - t, y: frame, w: t, h: height - frame * 2, fill: ink });
  }

  switch (design.pattern) {
    case 'diamonds': {
      const cols = 4 + Math.floor(rng() * 3);
      const cell = innerW / cols;
      const rows = Math.max(1, Math.ceil(innerH / cell));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = inset + c * cell;
          const y0 = inset + r * cell;
          const x1 = Math.min(x0 + cell, inset + innerW);
          const y1 = Math.min(y0 + cell, inset + innerH);
          const mx = (x0 + x1) / 2;
          const my = (y0 + y1) / 2;
          shapes.push({
            kind: 'poly',
            points: [mx, y0, x1, my, mx, y1, x0, my],
            fill: (r + c) % 2 === 0 ? ink : accent
          });
        }
      }
      break;
    }
    case 'lattice': {
      const step = innerW / (5 + Math.floor(rng() * 3));
      const span = Math.ceil((innerW + innerH) / step);
      for (let d = -span; d <= span; d++) {
        const offset = d * step;
        shapes.push({
          kind: 'line',
          x1: inset + offset,
          y1: inset,
          x2: inset + offset + innerH,
          y2: inset + innerH,
          stroke: ink,
          width: Math.max(1, step * 0.14)
        });
        shapes.push({
          kind: 'line',
          x1: inset + offset,
          y1: inset + innerH,
          x2: inset + offset + innerH,
          y2: inset,
          stroke: accent,
          width: Math.max(1, step * 0.1)
        });
      }
      break;
    }
    case 'circles': {
      const cols = 3 + Math.floor(rng() * 2);
      const cell = innerW / cols;
      const rows = Math.max(1, Math.ceil(innerH / cell));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = inset + (c + 0.5) * cell;
          const cy = inset + (r + 0.5) * Math.min(cell, innerH / rows);
          const radius = Math.min(cell, innerH / rows) * (0.24 + rng() * 0.1);
          shapes.push({ kind: 'circle', cx, cy, r: radius, stroke: ink, width: Math.max(1, cell * 0.06) });
          shapes.push({ kind: 'circle', cx, cy, r: radius * 0.45, stroke: accent, width: Math.max(1, cell * 0.05) });
        }
      }
      break;
    }
    case 'waves': {
      const bands = 5 + Math.floor(rng() * 3);
      const bandH = innerH / bands;
      const amplitude = bandH * 0.35;
      const cycles = 2 + Math.floor(rng() * 3);
      const steps = 16;
      for (let b = 0; b < bands; b++) {
        const centreY = inset + (b + 0.5) * bandH;
        const phase = rng() * Math.PI * 2;
        const points: number[] = [];
        for (let s = 0; s <= steps; s++) {
          const x = inset + (innerW * s) / steps;
          const y = centreY + amplitude * Math.sin((cycles * Math.PI * 2 * s) / steps + phase);
          points.push(x, y);
        }
        shapes.push({
          kind: 'path',
          points,
          stroke: b % 2 === 0 ? ink : accent,
          width: Math.max(1, bandH * 0.14)
        });
      }
      break;
    }
    case 'dots': {
      const cols = 5 + Math.floor(rng() * 3);
      const cell = innerW / cols;
      const rows = Math.max(1, Math.ceil(innerH / cell));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          shapes.push({
            kind: 'circle',
            cx: inset + (c + 0.5) * cell,
            cy: inset + (r + 0.5) * Math.min(cell, innerH / rows),
            r: cell * (0.14 + rng() * 0.12),
            fill: (r + c) % 2 === 0 ? ink : accent
          });
        }
      }
      break;
    }
    case 'plain':
    default:
      break;
  }

  const title = design.title.trim();
  if (design.showTitle && title) {
    // Shrink the type so the whole name fits instead of being cut off.
    const size = Math.max(
      8,
      Math.min(height * 0.12, innerW * 0.16, (innerW * 0.92) / (title.length * 0.62))
    );
    const band = size * 1.6;
    // Two mirrored name plates: readable whichever way the card is flipped.
    for (const [cy, rotation] of [[height * 0.26, 0], [height * 0.74, 180]] as const) {
      shapes.push({ kind: 'rect', x: inset, y: cy - band / 2, w: innerW, h: band, fill: ink });
      shapes.push({ kind: 'text', text: title, cx: width / 2, cy, size, color: design.base, rotateDeg: rotation });
    }
  }

  return shapes;
}

/* ----------------------------------------------------------- resolution */

export type BackSource =
  | { kind: 'image'; assetId: string }
  | { kind: 'generated'; design: GeneratedBack }
  | { kind: 'neutral' };

/**
 * Single source of truth for "what is the back of this card?"
 * Card wins over deck; an uploaded image wins over a generated design.
 */
export function resolveBack(card: CardDefinition, deck?: DeckDefinition): BackSource {
  if (card.backAssetId) return { kind: 'image', assetId: card.backAssetId };
  if (card.backDesign) return { kind: 'generated', design: card.backDesign };
  if (deck?.defaultBackAssetId) return { kind: 'image', assetId: deck.defaultBackAssetId };
  if (deck?.defaultBackDesign) return { kind: 'generated', design: deck.defaultBackDesign };
  return { kind: 'neutral' };
}

export function backLabel(source: BackSource): string {
  if (source.kind === 'image') return 'Image back';
  if (source.kind === 'generated') return `${BACK_STYLES.find((s) => s.id === source.design.pattern)?.label ?? 'Generated'} back`;
  return 'Neutral back';
}
