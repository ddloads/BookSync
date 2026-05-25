/** Convert ISO 8601 duration (e.g. PT12H30M) to human-readable string. */
export function parseIsoDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] || '0');
  const min = parseInt(m[2] || '0');
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hr${h !== 1 ? 's' : ''}`);
  if (min > 0) parts.push(`${min} min${min !== 1 ? 's' : ''}`);
  return parts.join(' ') || iso;
}
