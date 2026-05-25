import { describe, it, expect } from 'vitest';
import { BookSchema, BookDetailsSchema, LogEntrySchema, MetadataJsonSchema } from '../schemas';

describe('BookSchema', () => {
  const validBook = {
    id: 'B00ABC1234',
    title: 'Test Book',
    author: 'Test Author',
    series: null,
    coverUrl: null,
    downloadUrl: null,
    isDownloaded: false,
    isInAbs: false,
  };

  it('accepts a minimal valid book', () => {
    const result = BookSchema.safeParse(validBook);
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated book', () => {
    const full = {
      ...validBook,
      narrator: 'Test Narrator',
      series: 'Test Series',
      duration: '5 hrs and 30 mins',
      purchaseDate: '2024-01-10T00:00:00.000Z',
      addedDate: '2024-01-15T00:00:00.000Z',
      lastDownloadAt: '2024-02-01T12:00:00.000Z',
      lastAbsConfirmedAt: '2024-02-02T12:00:00.000Z',
      coverUrl: 'https://example.com/cover.jpg',
      downloadUrl: 'https://example.com/download',
      isDownloaded: true,
      isInAbs: true,
      isIgnored: false,
    };
    const result = BookSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = BookSchema.safeParse({ id: 'B00ABC1234' });
    expect(result.success).toBe(false);
  });

  it('rejects wrong type for isDownloaded', () => {
    const result = BookSchema.safeParse({ ...validBook, isDownloaded: 'yes' });
    expect(result.success).toBe(false);
  });

  it('rejects wrong type for isInAbs', () => {
    const result = BookSchema.safeParse({ ...validBook, isInAbs: 'yes' });
    expect(result.success).toBe(false);
  });

  it('allows nullable series', () => {
    const result = BookSchema.safeParse({ ...validBook, series: null });
    expect(result.success).toBe(true);
  });

  it('allows string series', () => {
    const result = BookSchema.safeParse({ ...validBook, series: 'My Series' });
    expect(result.success).toBe(true);
  });

  it('allows optional narrator', () => {
    const withNarrator = { ...validBook, narrator: 'Narrator' };
    const without = { ...validBook };
    expect(BookSchema.safeParse(withNarrator).success).toBe(true);
    expect(BookSchema.safeParse(without).success).toBe(true);
  });

  it('allows null addedDate', () => {
    const result = BookSchema.safeParse({ ...validBook, addedDate: null });
    expect(result.success).toBe(true);
  });

  it('allows null purchaseDate', () => {
    const result = BookSchema.safeParse({ ...validBook, purchaseDate: null });
    expect(result.success).toBe(true);
  });
});

describe('BookDetailsSchema', () => {
  const validDetails = {
    description: 'A great book',
    duration: '10 hrs',
    releaseDate: '2023-05-01',
    publisher: 'Publisher',
    format: 'Unabridged',
    language: 'English',
    rating: { value: 4.5, count: 1200 },
    categories: ['Fiction', 'Sci-Fi'],
    copyright: '© 2023 Author',
    seriesSequence: '1',
    infoLink: 'https://www.audible.com/pd/B00ABC1234',
  };

  it('accepts valid book details', () => {
    const result = BookDetailsSchema.safeParse(validDetails);
    expect(result.success).toBe(true);
  });

  it('accepts null rating', () => {
    const result = BookDetailsSchema.safeParse({ ...validDetails, rating: null });
    expect(result.success).toBe(true);
  });

  it('accepts empty categories array', () => {
    const result = BookDetailsSchema.safeParse({ ...validDetails, categories: [] });
    expect(result.success).toBe(true);
  });

  it('rejects missing description', () => {
    const { description, ...rest } = validDetails;
    const result = BookDetailsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-array categories', () => {
    const result = BookDetailsSchema.safeParse({ ...validDetails, categories: 'Fiction' });
    expect(result.success).toBe(false);
  });
});

describe('LogEntrySchema', () => {
  it('accepts a valid log entry', () => {
    const result = LogEntrySchema.safeParse({
      id: 1,
      type: 'success',
      title: 'Download',
      message: 'Book downloaded',
      timestamp: '2024-01-15T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid type values', () => {
    for (const type of ['success', 'error', 'info']) {
      const result = LogEntrySchema.safeParse({
        id: 1,
        type,
        title: 'Test',
        message: 'Test',
        timestamp: '2024-01-15',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid type value', () => {
    const result = LogEntrySchema.safeParse({
      id: 1,
      type: 'warning',
      title: 'Test',
      message: 'Test',
      timestamp: '2024-01-15',
    });
    expect(result.success).toBe(false);
  });
});

describe('MetadataJsonSchema', () => {
  it('accepts object with asin field', () => {
    const result = MetadataJsonSchema.safeParse({ asin: 'B00ABC1234' });
    expect(result.success).toBe(true);
  });

  it('accepts object with ASIN field', () => {
    const result = MetadataJsonSchema.safeParse({ ASIN: 'B00ABC1234' });
    expect(result.success).toBe(true);
  });

  it('accepts object with extra fields (loose)', () => {
    const result = MetadataJsonSchema.safeParse({
      asin: 'B00ABC1234',
      title: 'Some Book',
      authors: ['Author'],
      randomField: 42,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = MetadataJsonSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects non-object input', () => {
    const result = MetadataJsonSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('rejects array input', () => {
    const result = MetadataJsonSchema.safeParse([{ asin: 'B00ABC1234' }]);
    expect(result.success).toBe(false);
  });
});
