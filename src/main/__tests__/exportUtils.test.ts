import { describe, it, expect } from 'vitest';
import { parseExpectedDurationSeconds } from '../exportUtils';

describe('parseExpectedDurationSeconds', () => {
  it('parses "5 hrs and 30 mins"', () => {
    expect(parseExpectedDurationSeconds('5 hrs and 30 mins')).toBe(5 * 3600 + 30 * 60);
  });

  it('parses hours only', () => {
    expect(parseExpectedDurationSeconds('2 hrs')).toBe(2 * 3600);
  });

  it('parses minutes only', () => {
    expect(parseExpectedDurationSeconds('45 mins')).toBe(45 * 60);
  });

  it('parses seconds only', () => {
    expect(parseExpectedDurationSeconds('30 secs')).toBe(30);
  });

  it('parses "1 hour 15 minutes 10 seconds"', () => {
    expect(parseExpectedDurationSeconds('1 hour 15 minutes 10 seconds')).toBe(3600 + 15 * 60 + 10);
  });

  it('returns 0 for undefined', () => {
    expect(parseExpectedDurationSeconds(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseExpectedDurationSeconds('')).toBe(0);
  });

  it('returns 0 for unparseable string', () => {
    expect(parseExpectedDurationSeconds('unknown duration')).toBe(0);
  });

  it('parses "10 hr and 5 min"', () => {
    expect(parseExpectedDurationSeconds('10 hr and 5 min')).toBe(10 * 3600 + 5 * 60);
  });

  it('parses "3 hours"', () => {
    expect(parseExpectedDurationSeconds('3 hours')).toBe(3 * 3600);
  });
});
