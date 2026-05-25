import path from 'path'
import { Book } from '../shared/schemas'
import { sanitize } from './utils'

type AbsAuthor = { name?: string } | string

export type AbsLibraryItem = {
  relPath?: string
  media?: {
    metadata?: {
      asin?: string
      ASIN?: string
      title?: string
      subtitle?: string
      authorName?: string
      author?: string
      authors?: AbsAuthor[]
    }
  }
}

type IndexedAbsItem = {
  asin?: string
  folder?: string
  title?: string
  titleVariants: Set<string>
  authorVariants: Set<string>
}

export type AbsMatchReason =
  | 'asin'
  | 'title-author'
  | 'title-subtitle-author'
  | 'folder-author'
  | 'recent-download-grace'

export type AbsMatch = {
  reason: AbsMatchReason
}

export type AbsMatchOptions = {
  recentDownloadGraceMs?: number
  now?: number
}

export type AbsScanDecision = {
  foundIds: Set<string>
  matches: Map<string, AbsMatch>
  shouldResetUnmatched: boolean
}

export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function normalizePhrase(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getAuthorName(author: AbsAuthor): string {
  if (typeof author === 'string') return author
  return author?.name ?? ''
}

function collectAuthorVariants(author: string): Set<string> {
  const variants = new Set<string>()
  const clean = normalizePhrase(author)
  const fuzzy = normalizeForMatch(author)
  if (clean) variants.add(clean)
  if (fuzzy) variants.add(fuzzy)
  return variants
}

function collectTitleVariants(title: string, subtitle?: string): Set<string> {
  const variants = new Set<string>()

  const add = (value: string) => {
    const clean = normalizePhrase(value)
    const fuzzy = normalizeForMatch(value)
    if (clean) variants.add(clean)
    if (fuzzy) variants.add(fuzzy)

    const colonIdx = clean.indexOf(':')
    if (colonIdx > 0) {
      const baseTitle = clean.slice(0, colonIdx).trim()
      const fuzzyBaseTitle = normalizeForMatch(baseTitle)
      if (baseTitle) variants.add(baseTitle)
      if (fuzzyBaseTitle) variants.add(fuzzyBaseTitle)
    }
  }

  add(title)
  if (subtitle) add(`${title}: ${subtitle}`)
  return variants
}

function getExpectedFolders(book: Book): Set<string> {
  const folders = new Set<string>()
  const add = (value: string | null | undefined) => {
    if (!value) return
    const sanitized = sanitize(value)
    const fuzzySanitized = normalizeForMatch(sanitized)
    const fuzzyRaw = normalizeForMatch(value)
    if (fuzzySanitized) folders.add(fuzzySanitized)
    if (fuzzyRaw) folders.add(fuzzyRaw)
  }

  add(book.title)
  const colonIdx = book.title.indexOf(':')
  if (colonIdx > 0) add(book.title.slice(0, colonIdx).trim())
  return folders
}

function extractFolder(relPath?: string): string | undefined {
  if (!relPath) return undefined
  const normalizedPath = relPath.replace(/\\/g, '/')
  const folderName = path.posix.basename(normalizedPath)
  const normalized = normalizeForMatch(folderName)
  return normalized || undefined
}

function indexAbsItems(items: AbsLibraryItem[]): IndexedAbsItem[] {
  return items.map((item) => {
    const metadata = item.media?.metadata
    const author = metadata?.authorName
      || metadata?.author
      || (Array.isArray(metadata?.authors)
        ? metadata.authors.map(getAuthorName).filter(Boolean).join(', ')
        : '')

    return {
      asin: metadata?.asin || metadata?.ASIN ? String(metadata?.asin || metadata?.ASIN).trim().toUpperCase() : undefined,
      folder: extractFolder(item.relPath),
      title: metadata?.title,
      titleVariants: metadata?.title ? collectTitleVariants(metadata.title, metadata.subtitle) : new Set<string>(),
      authorVariants: author ? collectAuthorVariants(author) : new Set<string>()
    }
  })
}

function hasRecentDownloadGrace(book: Book, recentDownloadGraceMs: number, now: number): boolean {
  if (!book.isDownloaded || !book.lastDownloadAt) return false
  const parsed = Date.parse(book.lastDownloadAt)
  return Number.isFinite(parsed) && now - parsed < recentDownloadGraceMs
}

export function decideAbsMatches(
  books: Book[],
  items: AbsLibraryItem[],
  options: AbsMatchOptions = {}
): AbsScanDecision {
  const recentDownloadGraceMs = options.recentDownloadGraceMs ?? 0
  const now = options.now ?? Date.now()
  const indexedItems = indexAbsItems(items)

  const foundIds = new Set<string>()
  const matches = new Map<string, AbsMatch>()

  for (const book of books) {
    const normalizedId = book.id.trim().toUpperCase()
    const authorVariants = collectAuthorVariants(book.author)
    const expectedFolders = getExpectedFolders(book)
    const titleVariants = collectTitleVariants(book.title)

    const asinMatch = indexedItems.find(item => item.asin === normalizedId)
    if (asinMatch) {
      foundIds.add(book.id)
      matches.set(book.id, { reason: 'asin' })
      continue
    }

    const combinedTitleAuthorMatch = indexedItems.find((item) => {
      if (item.titleVariants.size === 0 || item.authorVariants.size === 0) return false
      return [...titleVariants].some(title => item.titleVariants.has(title))
        && [...authorVariants].some(author => item.authorVariants.has(author))
    })
    if (combinedTitleAuthorMatch) {
      const reason = combinedTitleAuthorMatch.title && normalizePhrase(combinedTitleAuthorMatch.title) !== normalizePhrase(book.title)
        ? 'title-subtitle-author'
        : 'title-author'
      foundIds.add(book.id)
      matches.set(book.id, { reason })
      continue
    }

    const folderAuthorMatch = indexedItems.find((item) => {
      if (!item.folder || item.authorVariants.size === 0) return false
      return expectedFolders.has(item.folder)
        && [...authorVariants].some(author => item.authorVariants.has(author))
    })
    if (folderAuthorMatch) {
      foundIds.add(book.id)
      matches.set(book.id, { reason: 'folder-author' })
      continue
    }

    if (hasRecentDownloadGrace(book, recentDownloadGraceMs, now)) {
      foundIds.add(book.id)
      matches.set(book.id, { reason: 'recent-download-grace' })
    }
  }

  return {
    foundIds,
    matches,
    // ABS scans are used as positive confirmation only. They are not safe enough
    // to clear local state because library rescans and imports can lag behind exports.
    shouldResetUnmatched: false
  }
}
