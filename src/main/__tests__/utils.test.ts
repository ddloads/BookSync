import { describe, it, expect } from 'vitest';
import { sanitize } from '../utils';

describe('sanitize', () => {
  it('replaces illegal path characters with underscores', () => {
    expect(sanitize('Book: Title?')).toBe('Book_ Title_');
  });

  it('replaces all reserved characters', () => {
    expect(sanitize('<>:"/\\|?*')).toBe('_________');
  });

  it('leaves safe characters unchanged', () => {
    expect(sanitize('Normal Title 123')).toBe('Normal Title 123');
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('handles names with apostrophes and hyphens', () => {
    expect(sanitize("Author's Book-Title")).toBe("Author's Book-Title");
  });
});
