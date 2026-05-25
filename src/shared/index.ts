export {
  BookSchema,
  BookDetailsSchema,
  LogEntrySchema,
  MetadataJsonSchema,
} from './schemas';

export type { Book, BookDetails, LogEntry, MetadataJson } from './schemas';

export { safeParseJSON, safeValidate } from './validate';

export function normalizeContributorName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([A-Za-z])\.\s+(?=[A-Za-z]\.)/g, '$1.')
}
