/**
 * Natural (human-friendly) sort: "card 2.png" before "card 10.png".
 */
export function naturalCompare(a: string, b: string): number {
  const aTokens = a.match(/\d+|\D+/g) ?? [];
  const bTokens = b.match(/\d+|\D+/g) ?? [];
  const max = Math.max(aTokens.length, bTokens.length);
  for (let i = 0; i < max; i++) {
    const ta = aTokens[i];
    const tb = bTokens[i];
    if (ta === undefined) return -1;
    if (tb === undefined) return 1;
    const na = Number(ta);
    const nb = Number(tb);
    const bothNumbers = /^\d+$/.test(ta) && /^\d+$/.test(tb);
    if (bothNumbers) {
      if (na !== nb) return na - nb;
    } else if (ta !== tb) {
      return ta.localeCompare(tb);
    }
  }
  return 0;
}
