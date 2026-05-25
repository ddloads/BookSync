import { describe, it, expect } from 'vitest';
import { parseIsoDuration } from '../audibleUtils';

describe('parseIsoDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseIsoDuration('PT12H30M')).toBe('12 hrs 30 mins');
  });

  it('parses hours only', () => {
    expect(parseIsoDuration('PT5H')).toBe('5 hrs');
  });

  it('parses minutes only', () => {
    expect(parseIsoDuration('PT45M')).toBe('45 mins');
  });

  it('parses single hour (no plural)', () => {
    expect(parseIsoDuration('PT1H')).toBe('1 hr');
  });

  it('parses single minute (no plural)', () => {
    expect(parseIsoDuration('PT1M')).toBe('1 min');
  });

  it('handles hours, minutes, and seconds (ignores seconds)', () => {
    expect(parseIsoDuration('PT2H15M30S')).toBe('2 hrs 15 mins');
  });

  it('returns original string for non-matching format', () => {
    expect(parseIsoDuration('invalid')).toBe('invalid');
  });

  it('returns original string for empty PT', () => {
    // PT with no H/M/S won't match — falls through
    expect(parseIsoDuration('PT')).toBe('PT');
  });

  it('parses zero hours with minutes', () => {
    expect(parseIsoDuration('PT0H30M')).toBe('30 mins');
  });
});
