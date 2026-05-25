import * as z from 'zod';

// ── Book ──────────────────────────────────────────────────────────────────────
export const BookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  narrator: z.string().optional(),
  series: z.string().nullable(),
  seriesSequence: z.string().nullable().optional(),
  duration: z.string().optional(),
  publisher: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  addedDate: z.string().nullable().optional(),
  lastDownloadAt: z.string().nullable().optional(),
  lastAbsConfirmedAt: z.string().nullable().optional(),
  coverUrl: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  isDownloaded: z.boolean(),
  nasPath: z.string().nullable().optional(),
  isInAbs: z.boolean().optional(),
  isIgnored: z.boolean().optional(),
  accountId: z.string().optional(),
  downloadProgress: z.number().optional(),
  downloadPhase: z.string().optional(),
});

export type Book = z.infer<typeof BookSchema>;

// ── BookDetails ───────────────────────────────────────────────────────────────
export const BookDetailsSchema = z.object({
  description: z.string(),
  duration: z.string(),
  releaseDate: z.string(),
  publisher: z.string(),
  format: z.string(),
  language: z.string(),
  rating: z
    .object({ value: z.coerce.number(), count: z.coerce.number() })
    .nullable(),
  categories: z.array(z.string()),
  copyright: z.string(),
  seriesSequence: z.string(),
  infoLink: z.string(),
});

export type BookDetails = z.infer<typeof BookDetailsSchema>;

// ── LogEntry ──────────────────────────────────────────────────────────────────
export const LogEntrySchema = z.object({
  id: z.number(),
  type: z.enum(['success', 'error', 'info']),
  title: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

// ── MetadataJson (Audiobookshelf metadata.json — loose, only validates asin) ─
export const MetadataJsonSchema = z.looseObject({
  asin: z.string().optional(),
  ASIN: z.string().optional(),
});

export type MetadataJson = z.infer<typeof MetadataJsonSchema>;
