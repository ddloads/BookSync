import fs from 'fs'
import path from 'path'
import * as mm from 'music-metadata'
import { sanitize } from './utils'
import type { Book } from './types'
import { extractCoreTitles, cleanFolderName, cleanFileName, normalize } from './scanUtils'
import { MetadataJsonSchema } from '../shared/schemas'

export type ScanProgress = {
  current: number
  total: number
  filename: string
}

export type ScanProgressCallback = (progress: ScanProgress) => void

export async function scanAndMatchCore(
  nasPath: string,
  books: Book[],
  onProgress?: ScanProgressCallback
): Promise<Array<{ id: string; path: string }>> {
  if (!nasPath || !fs.existsSync(nasPath)) {
    return []
  }

  const foundResults = new Map<string, string>()

  for (const book of books) {
    const authorDir = sanitize(book.author)
    const seriesDir = book.series ? sanitize(book.series) : ''
    const titleDir = sanitize(book.title)
    const fileName = `${sanitize(book.title)}.m4b`

    let expectedPath = path.join(nasPath, authorDir)
    if (seriesDir) {
      expectedPath = path.join(expectedPath, seriesDir)
    }
    expectedPath = path.join(expectedPath, titleDir, fileName)

    if (fs.existsSync(expectedPath)) {
      foundResults.set(book.id, expectedPath)
    }
  }

  if (books.every((book) => foundResults.has(book.id))) {
    return Array.from(foundResults.entries()).map(([id, path]) => ({ id, path }))
  }

  const audioFiles: string[] = []
  const metadataFiles: string[] = []
  await walk(nasPath, (filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.m4b' || ext === '.aax') {
      audioFiles.push(filePath)
    } else if (path.basename(filePath).toLowerCase() === 'metadata.json') {
      metadataFiles.push(filePath)
    }
  })

  const bookIdSet = new Set(books.map((book) => book.id.toUpperCase()))
  for (const metaFile of metadataFiles) {
    try {
      const raw = fs.readFileSync(metaFile, 'utf-8')
      const parsed = JSON.parse(raw)
      const result = MetadataJsonSchema.safeParse(parsed)
      if (!result.success) continue
      const content = result.data
      const asin = (content.asin || content.ASIN || '').toUpperCase()
      if (asin && bookIdSet.has(asin)) {
        const originalBook = books.find((book) => book.id.toUpperCase() === asin)
        if (originalBook && !foundResults.has(originalBook.id)) {
          // Look for an audio file in the same directory as metadata.json
          const dir = path.dirname(metaFile)
          const items = fs.readdirSync(dir)
          const audioInDir = items.find(item => {
            const ext = path.extname(item).toLowerCase()
            return ext === '.m4b' || ext === '.aax'
          })
          if (audioInDir) {
            foundResults.set(originalBook.id, path.join(dir, audioInDir))
          }
        }
      }
    } catch {
      // Skip unreadable metadata files.
    }
  }

  let unmatchedBooks = books.filter((book) => !foundResults.has(book.id))
  if (unmatchedBooks.length === 0) {
    return Array.from(foundResults.entries()).map(([id, path]) => ({ id, path }))
  }

  const bookCores = unmatchedBooks.map((book) => ({
    book,
    cores: extractCoreTitles(book.title)
  }))

  for (const filePath of audioFiles) {
    const relativePath = path.relative(nasPath, filePath)
    const segments = relativePath.split(path.sep)
    const normSegments = segments.map((segment) => normalize(segment))

    const parentFolder = segments.length >= 2 ? segments[segments.length - 2] : ''
    const normFolder = normalize(cleanFolderName(parentFolder))

    const fileName = path.basename(filePath, path.extname(filePath))
    const normFileName = normalize(cleanFileName(fileName))

    for (const { book, cores } of bookCores) {
      if (foundResults.has(book.id)) continue

      const normAuthor = normalize(book.author)
      if (!normSegments.some((segment) => segment.includes(normAuthor))) continue

      const matched = cores.some((core) =>
        core.length > 5 &&
        (normFolder === core ||
          normFileName === core ||
          normFolder.includes(core) ||
          normFileName.includes(core))
      )

      if (matched) {
        foundResults.set(book.id, filePath)
      }
    }
  }

  unmatchedBooks = books.filter((book) => !foundResults.has(book.id))
  if (unmatchedBooks.length === 0) {
    return Array.from(foundResults.entries()).map(([id, path]) => ({ id, path }))
  }

  const unmatchedByTitle = new Map<string, Book>()
  for (const book of unmatchedBooks) {
    unmatchedByTitle.set(normalize(book.title), book)
    for (const core of extractCoreTitles(book.title)) {
      if (core.length > 5 && !unmatchedByTitle.has(core)) {
        unmatchedByTitle.set(core, book)
      }
    }
  }

  const concurrency = 10
  for (let i = 0; i < audioFiles.length; i += concurrency) {
    const chunk = audioFiles.slice(i, i + concurrency)

    await Promise.all(
      chunk.map(async (filePath, index) => {
        if (onProgress) {
          onProgress({
            current: i + index + 1,
            total: audioFiles.length,
            filename: path.basename(filePath)
          })
        }

        if (unmatchedByTitle.size === 0) return

        try {
          const metadata = await mm.parseFile(filePath, { skipCovers: true })
          const title = metadata.common.title
          const artist = metadata.common.artist || metadata.common.albumartist

          if (title) {
            const normTitle = normalize(title)
            const book = unmatchedByTitle.get(normTitle)

            if (book && !foundResults.has(book.id)) {
              if (
                !artist ||
                normalize(artist).includes(normalize(book.author)) ||
                normalize(book.author).includes(normalize(artist))
              ) {
                foundResults.set(book.id, filePath)
                unmatchedByTitle.delete(normTitle)
              }
            }
          }

          const comment = metadata.common.comment?.join(' ') || ''
          for (const book of unmatchedBooks) {
            if (foundResults.has(book.id)) continue
            if (comment.includes(book.id)) {
              foundResults.set(book.id, filePath)
            }
          }
        } catch {
          // Skip files that can't be parsed.
        }
      })
    )

    if (unmatchedByTitle.size === 0) break
  }

  return Array.from(foundResults.entries()).map(([id, path]) => ({ id, path }))
}

async function walk(dir: string, callback: (filePath: string) => void): Promise<void> {
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(filePath, callback)
    } else {
      callback(filePath)
    }
  }
}
