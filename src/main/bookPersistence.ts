import type { Book } from '../shared/schemas'

export function mergeBooksForSave(
  existingBooks: ReadonlyMap<string, Book>,
  incomingBooks: Book[],
  options?: { pruneMissing?: boolean }
): Book[] {
  const pruneMissing = options?.pruneMissing ?? false
  const merged = new Map<string, Book>()

  for (const book of incomingBooks) {
    const prev = existingBooks.get(book.id)
    merged.set(book.id, {
      ...book,
      isDownloaded: prev?.isDownloaded ?? false,
      isInAbs: prev?.isInAbs ?? false,
      azureHasSilent: prev?.azureHasSilent ?? false,
      isIgnored: prev?.isIgnored ?? false,
      accountId: book.accountId || prev?.accountId,
      seriesSequence: book.seriesSequence || prev?.seriesSequence || null,
      purchaseDate: book.purchaseDate || prev?.purchaseDate || book.addedDate || prev?.addedDate || null,
      addedDate: book.addedDate || prev?.addedDate || null,
      lastDownloadAt: prev?.lastDownloadAt || null,
      lastAbsConfirmedAt: prev?.lastAbsConfirmedAt || null
    })
  }

  if (!pruneMissing) {
    for (const [id, book] of existingBooks.entries()) {
      if (!merged.has(id)) merged.set(id, book)
    }
  }

  return Array.from(merged.values())
}
