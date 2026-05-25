export function parseExpectedDurationSeconds(durationRaw?: string): number {
  if (!durationRaw) return 0;
  const raw = durationRaw.toLowerCase();
  const h = parseInt((raw.match(/(\d+)\s*h(?:r|our)?s?/) || [])[1] || '0', 10);
  const m = parseInt((raw.match(/(\d+)\s*m(?:in|inute)?s?/) || [])[1] || '0', 10);
  const s = parseInt((raw.match(/(\d+)\s*s(?:ec|econd)?s?/) || [])[1] || '0', 10);
  return h * 3600 + m * 60 + s;
}
