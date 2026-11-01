// Migration scaffolding. Version 1 is the initial schema (see db.ts).
// When schema changes are needed, add db.version(2).schema({...}) here and
// document the data transformation in a comment. Export/import manifests carry
// `schemaVersion` so older archives can be upgraded on import.

export const CURRENT_SCHEMA_VERSION = 1;

export function assertSupportedSchemaVersion(version: number): void {
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Project uses schema version ${version}, which is newer than this app supports (${CURRENT_SCHEMA_VERSION}).`
    );
  }
}
