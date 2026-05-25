import { describe, it, expect } from 'vitest';
import { extractCoreTitles, cleanFolderName, cleanFileName, normalize } from '../scanUtils';

describe('normalize', () => {
  it('lowercases and strips non-alphanumeric characters', () => {
    expect(normalize('Hello, World!')).toBe('helloworld');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('strips spaces, hyphens, apostrophes', () => {
    expect(normalize("It's a Test-Case")).toBe('itsatestcase');
  });

  it('keeps digits', () => {
    expect(normalize('Book 1: Title')).toBe('book1title');
  });
});

describe('extractCoreTitles', () => {
  it('returns normalized full title', () => {
    const cores = extractCoreTitles('My Great Book');
    expect(cores).toContain('mygreatbook');
  });

  it('splits on colon and includes after-colon part', () => {
    const cores = extractCoreTitles('Series Name: The Actual Title, Book 1');
    expect(cores).toContain('seriesnametheactualtitlebook1');
    expect(cores).toContain('theactualtitlebook1');
    expect(cores).toContain('theactualtitle');
  });

  it('strips Book/Part/Volume sequence suffix', () => {
    const cores = extractCoreTitles('Series: Great Adventure, Book 3');
    expect(cores).toContain('greatadventure');
  });

  it('handles title without colon', () => {
    const cores = extractCoreTitles('Simple Title');
    expect(cores).toEqual(['simpletitle']);
  });

  it('deduplicates results', () => {
    const cores = extractCoreTitles('A: A');
    // After colon is 'A' which normalizes to 'a' (length <= 3, so skipped)
    // Only full title remains
    expect(new Set(cores).size).toBe(cores.length);
  });

  it('strips Volume suffix', () => {
    const cores = extractCoreTitles('Series: Long Title Name, Volume 2');
    expect(cores).toContain('longtitlename');
  });
});

describe('cleanFolderName', () => {
  it('strips (Book N) suffix', () => {
    expect(cleanFolderName('My Book (Book 1)')).toBe('My Book');
  });

  it('strips (Part N) suffix', () => {
    expect(cleanFolderName('My Book (Part 2)')).toBe('My Book');
  });

  it('strips (YYYY) year suffix', () => {
    expect(cleanFolderName('My Book (2014)')).toBe('My Book');
  });

  it('strips bracketed content', () => {
    expect(cleanFolderName('My Book [Unabridged]')).toBe('My Book');
  });

  it('strips multiple decorations', () => {
    expect(cleanFolderName('My Book (Book 1) (2014) [MP3]')).toBe('My Book');
  });

  it('returns plain name unchanged', () => {
    expect(cleanFolderName('Clean Folder')).toBe('Clean Folder');
  });

  it('handles empty string', () => {
    expect(cleanFolderName('')).toBe('');
  });
});

describe('cleanFileName', () => {
  it('strips (YYYY) year', () => {
    expect(cleanFileName('My Book (2014)')).toBe('My Book');
  });

  it('strips bracketed content', () => {
    expect(cleanFileName('My Book [Unabridged]')).toBe('My Book');
  });

  it('strips - pt01 suffix', () => {
    expect(cleanFileName('My Book - pt01')).toBe('My Book');
  });

  it('strips - part 2 suffix', () => {
    expect(cleanFileName('My Book - part 2')).toBe('My Book');
  });

  it('strips - disc 1 suffix', () => {
    expect(cleanFileName('My Book - disc 1')).toBe('My Book');
  });

  it('returns clean name unchanged', () => {
    expect(cleanFileName('Clean File')).toBe('Clean File');
  });

  it('handles multiple decorations', () => {
    expect(cleanFileName('Book (2020) [MP3] - pt3')).toBe('Book');
  });
});
