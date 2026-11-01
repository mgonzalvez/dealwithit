/**
 * ZIP safety helpers (pure, testable). Rejects zip-slip style paths and
 * ignores OS metadata files.
 */

export function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isSafeArchivePath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith('/')) return false;
  const parts = normalizeArchivePath(path).split('/');
  return parts.every((part) => part !== '' && part !== '..');
}

export function isIgnoredArchivePath(path: string): boolean {
  const normalized = normalizeArchivePath(path);
  if (normalized.startsWith('__MACOSX/')) return true;
  const base = normalized.split('/').pop() ?? '';
  return base === '.DS_Store' || base === 'Thumbs.db' || base.startsWith('.');
}
