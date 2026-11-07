import { z } from 'zod';

export const imageMimeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp']);

export const imageTransformSchema = z.object({
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  scale: z.number().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  fit: z.enum(['contain', 'cover'])
});

export const imageAssetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  blobKey: z.string(),
  filename: z.string(),
  mime: imageMimeSchema,
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  sha256: z.string(),
  createdAt: z.number()
});

export const generatedBackSchema = z.object({
  seed: z.number().int().min(0),
  pattern: z.enum(['diamonds', 'lattice', 'circles', 'waves', 'dots', 'plain']),
  base: z.string().regex(/^#[0-9a-f]{6}$/i),
  ink: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  title: z.string().max(60),
  showTitle: z.boolean(),
  border: z.number().min(0).max(1)
});

export const cardDefinitionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1),
  frontAssetId: z.string(),
  backAssetId: z.string().optional(),
  backDesign: generatedBackSchema.optional(),
  frontTransform: imageTransformSchema,
  backTransform: imageTransformSchema.optional(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  tags: z.array(z.string())
});

export const deckEntrySchema = z.object({
  id: z.string(),
  cardDefinitionId: z.string(),
  quantity: z.number().int().positive()
});

export const deckDefinitionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1),
  entries: z.array(deckEntrySchema),
  defaultBackAssetId: z.string().optional(),
  defaultBackDesign: generatedBackSchema.optional(),
  icon: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number()
});

export const cardInstanceSchema = z.object({
  instanceId: z.string(),
  cardDefinitionId: z.string(),
  face: z.enum(['front', 'back']),
  rotationDeg: z.number()
});

export const tableObjectSchema = z.object({
  id: z.string(),
  type: z.enum(['card', 'stack']),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rotationDeg: z.number(),
  cardInstances: z.array(cardInstanceSchema),
  label: z.string().optional(),
  sourceDeckId: z.string().optional()
});

export const tableStateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  objects: z.array(tableObjectSchema),
  camera: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }),
  background: z.string(),
  updatedAt: z.number()
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  schemaVersion: z.number().int().positive(),
  createdAt: z.number(),
  updatedAt: z.number(),
  activeTableId: z.string().optional()
});

/**
 * Manifest contract for self-contained project exports (M4) and the
 * documented future Card Extractor bridge (M6). Import must also accept
 * plain image ZIPs without a manifest.
 */
export const projectManifestSchema = z.object({
  format: z.literal('dealwithit-project'),
  version: z.number().int().positive()
});

export const importManifestSchema = z.object({
  format: z.literal('dealwithit-import'),
  version: z.number().int().positive(),
  title: z.string().optional(),
  cards: z
    .array(
      z.object({
        id: z.string().optional(),
        front: z.string(),
        back: z.string().optional(),
        quantity: z.number().int().positive().optional(),
        deck: z.string().optional()
      })
    )
    .optional()
});
