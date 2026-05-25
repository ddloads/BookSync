/**
 * Extract normalized core title variants from an Audible title.
 * Handles "Series: Title, Book N" format by splitting at colon
 * and stripping sequence suffixes.
 */
export function extractCoreTitles(title: string): string[] {
  const cores: string[] = [];

  // Full title normalized
  cores.push(normalize(title));

  // Split at colon to handle "Series: Title, Book N" format
  const colonIdx = title.indexOf(':');
  if (colonIdx >= 0) {
    const afterColon = title.slice(colonIdx + 1).trim();

    // After colon with sequence (e.g. "A Learning Experience, Book 1")
    const normAfter = normalize(afterColon);
    if (normAfter.length > 3) cores.push(normAfter);

    // After colon with sequence stripped (e.g. "A Learning Experience")
    const stripped = afterColon.replace(/,?\s*(Book|Part|Volume|Vol\.?)\s*\d+\s*$/i, '').trim();
    const normStripped = normalize(stripped);
    if (normStripped.length > 3 && normStripped !== normAfter) cores.push(normStripped);
  }

  return [...new Set(cores)];
}

/** Strip common folder decorations: "(Book 1)", "(2014)", "[...]" */
export function cleanFolderName(name: string): string {
  return name
    .replace(/\(Book\s*\d+\)/gi, '')
    .replace(/\(Part\s*\d+\)/gi, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();
}

/** Strip common filename decorations: "(2014)", "[...]", "- pt01", etc. */
export function cleanFileName(name: string): string {
  return name
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/-\s*pt\d+$/i, '')
    .replace(/-\s*part\s*\d+$/i, '')
    .replace(/-\s*disc\s*\d+$/i, '')
    .trim();
}

export function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}
