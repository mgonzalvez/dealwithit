/**
 * Export helpers — full project export (.dealwithit.zip) lands in M4.
 * This module documents the export contract and provides a manifest builder.
 */
import { Project } from '../../domain/models';

export const EXPORT_FORMAT = 'dealwithit-project';
export const EXPORT_VERSION = 1;

export function buildManifest(project: Project) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    project
  };
}

export function exportFilename(projectName: string): string {
  const safe = projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'project';
  return `${safe}.dealwithit.zip`;
}
