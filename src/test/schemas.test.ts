import { describe, it, expect } from 'vitest';
import { projectSchema, importManifestSchema, deckDefinitionSchema } from '../domain/schemas';

describe('schemas', () => {
  it('accepts a valid project', () => {
    const project = {
      id: 'p1',
      name: 'My Game',
      schemaVersion: 1,
      createdAt: 1,
      updatedAt: 2
    };
    expect(projectSchema.parse(project).name).toBe('My Game');
  });

  it('rejects a project with an empty name', () => {
    const bad = { id: 'p1', name: '', schemaVersion: 1, createdAt: 1, updatedAt: 2 };
    expect(projectSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts the documented import manifest contract', () => {
    const manifest = {
      format: 'dealwithit-import',
      version: 1,
      title: 'Example PnP Game',
      cards: [{ front: 'images/a.png', back: 'images/back.png', quantity: 2, deck: 'Main Deck' }]
    };
    expect(importManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('rejects non-positive deck quantities', () => {
    const deck = {
      id: 'd1',
      projectId: 'p1',
      name: 'Deck',
      entries: [{ id: 'e1', cardDefinitionId: 'c1', quantity: 0 }],
      createdAt: 1,
      updatedAt: 2
    };
    expect(deckDefinitionSchema.safeParse(deck).success).toBe(false);
  });
});
