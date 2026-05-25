import { describe, it, expect } from 'vitest';
import { parseDurationToMinutes, parseAudibleDate, sanitizePath, compareField } from '../utils';
import type { Book } from '../types';

describe('parseDurationToMinutes', () => {
  it('parses "5 hrs and 30 mins"', () => {
    expect(parseDurationToMinutes('5 hrs and 30 mins')).toBe(330);
  });

  it('parses hours only', () => {
    expect(parseDurationToMinutes('2 hrs')).toBe(120);
  });

  it('parses minutes only', () => {
    expect(parseDurationToMinutes('45 mins')).toBe(45);
  });

  it('returns null for undefined', () => {
    expect(parseDurationToMinutes(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDurationToMinutes('')).toBeNull();
  });

  it('returns 0 for unparseable string', () => {
    expect(parseDurationToMinutes('unknown')).toBe(0);
  });

  it('parses "10 hrs and 5 mins"', () => {
    expect(parseDurationToMinutes('10 hrs and 5 mins')).toBe(605);
  });

  it('parses single hr/min', () => {
    expect(parseDurationToMinutes('1 hr and 1 min')).toBe(61);
  });
});

describe('parseAudibleDate', () => {
  it('parses ISO date', () => {
    const result = parseAudibleDate('2024-03-15');
    expect(result).not.toBeNull();
    expect(new Date(result!).getFullYear()).toBe(2024);
  });

  it('parses Audible MM-DD-YY format', () => {
    const result = parseAudibleDate('03-15-24');
    expect(result).not.toBeNull();
    expect(new Date(result!).getFullYear()).toBe(2024);
  });

  it('parses Audible MM-DD-YYYY format', () => {
    const result = parseAudibleDate('03-15-2024');
    expect(result).not.toBeNull();
  });

  it('handles old dates (YY >= 30 maps to 1900s)', () => {
    const result = parseAudibleDate('01-01-95');
    expect(result).not.toBeNull();
    expect(new Date(result!).getFullYear()).toBe(1995);
  });

  it('returns null for empty string', () => {
    expect(parseAudibleDate('')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseAudibleDate('not-a-date')).toBeNull();
  });

  it('parses full date string', () => {
    const result = parseAudibleDate('January 15, 2024');
    expect(result).not.toBeNull();
  });
});

describe('sanitizePath', () => {
  it('replaces illegal characters with underscores', () => {
    expect(sanitizePath('Book: Title?')).toBe('Book_ Title_');
  });

  it('replaces all reserved characters', () => {
    expect(sanitizePath('<>:"/\\|?*')).toBe('_________');
  });

  it('leaves safe characters unchanged', () => {
    expect(sanitizePath('Normal Title 123')).toBe('Normal Title 123');
  });

  it('handles empty string', () => {
    expect(sanitizePath('')).toBe('');
  });
});

describe('compareField', () => {
  const makeBook = (overrides: Partial<Book> = {}): Book => ({
    id: 'B001',
    title: 'Alpha',
    author: 'Author A',
    series: null,
    coverUrl: null,
    downloadUrl: null,
    isDownloaded: false,
    ...overrides,
  });

  it('sorts by title ascending', () => {
    const a = makeBook({ title: 'Alpha' });
    const b = makeBook({ title: 'Beta' });
    expect(compareField(a, b, 'title', 'asc')).toBeLessThan(0);
  });

  it('sorts by title descending', () => {
    const a = makeBook({ title: 'Alpha' });
    const b = makeBook({ title: 'Beta' });
    expect(compareField(a, b, 'title', 'desc')).toBeGreaterThan(0);
  });

  it('sorts by duration (numeric comparison)', () => {
    const a = makeBook({ duration: '2 hrs and 30 mins' });
    const b = makeBook({ duration: '5 hrs and 0 mins' });
    expect(compareField(a, b, 'duration', 'asc')).toBeLessThan(0);
  });

  it('pushes null duration to end', () => {
    const a = makeBook({ duration: undefined });
    const b = makeBook({ duration: '5 hrs' });
    expect(compareField(a, b, 'duration', 'asc')).toBe(1);
  });

  it('sorts by purchaseDate ascending', () => {
    const a = makeBook({ purchaseDate: '2023-01-01T00:00:00Z' });
    const b = makeBook({ purchaseDate: '2024-01-01T00:00:00Z' });
    expect(compareField(a, b, 'purchaseDate', 'asc')).toBeLessThan(0);
  });

  it('pushes null purchaseDate to end', () => {
    const a = makeBook({ purchaseDate: null });
    const b = makeBook({ purchaseDate: '2024-01-01T00:00:00Z' });
    expect(compareField(a, b, 'purchaseDate', 'asc')).toBe(1);
  });

  it('handles both null series', () => {
    const a = makeBook({ series: null });
    const b = makeBook({ series: null });
    expect(compareField(a, b, 'series', 'asc')).toBe(0);
  });

  it('pushes null series to end', () => {
    const a = makeBook({ series: null });
    const b = makeBook({ series: 'A Series' });
    expect(compareField(a, b, 'series', 'asc')).toBe(1);
  });
});
