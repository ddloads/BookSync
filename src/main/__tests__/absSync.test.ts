import { describe, expect, it } from 'vitest'
import { decideAbsMatches, normalizeForMatch, type AbsLibraryItem } from '../absSync'
import type { Book } from '../../shared/schemas'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'B001',
    title: 'Default Title',
    author: 'Default Author',
    narrator: 'Narrator',
    series: null,
    duration: '1 hr',
    addedDate: null,
    lastDownloadAt: null,
    lastAbsConfirmedAt: null,
    coverUrl: null,
    downloadUrl: null,
    isDownloaded: false,
    isInAbs: false,
    isIgnored: false,
    ...overrides
  }
}

function makeAbsItem(overrides: Partial<AbsLibraryItem> = {}): AbsLibraryItem {
  return {
    relPath: '/Author/Default Title',
    media: {
      metadata: {
        title: 'Default Title',
        authorName: 'Default Author'
      }
    },
    ...overrides
  }
}

describe('normalizeForMatch', () => {
  it('removes diacritics without dropping letters', () => {
    expect(normalizeForMatch('Jos\u00E9\'s L\'\u00E9tranger')).toBe('josesletranger')
  })
})

describe('decideAbsMatches', () => {
  it('matches by ASIN', () => {
    const books = [makeBook({ id: 'B0ABC12345' })]
    const items = [makeAbsItem({ media: { metadata: { asin: 'b0abc12345' } } })]

    const decision = decideAbsMatches(books, items)

    expect(decision.foundIds.has('B0ABC12345')).toBe(true)
    expect(decision.matches.get('B0ABC12345')?.reason).toBe('asin')
  })

  it('matches when ABS splits subtitle into a separate field', () => {
    const books = [makeBook({ id: 'B002', title: 'The Book: A Tale', author: 'Jane Doe' })]
    const items = [makeAbsItem({
      relPath: '/Jane Doe/The Book A Tale',
      media: { metadata: { title: 'The Book', subtitle: 'A Tale', authorName: 'Jane Doe' } }
    })]

    const decision = decideAbsMatches(books, items)

    expect(decision.foundIds.has('B002')).toBe(true)
    expect(decision.matches.get('B002')?.reason).toBe('title-subtitle-author')
  })

  it('does not match by title alone when authors differ', () => {
    const books = [makeBook({ id: 'B003', title: 'Shared Title', author: 'Author One' })]
    const items = [makeAbsItem({
      media: { metadata: { title: 'Shared Title', authorName: 'Author Two' } }
    })]

    const decision = decideAbsMatches(books, items)

    expect(decision.foundIds.has('B003')).toBe(false)
  })

  it('matches Unicode author and title variants', () => {
    const books = [makeBook({ id: 'B004', title: 'L\'\u00E9tranger', author: 'Jos\u00E9 Saramago' })]
    const items = [makeAbsItem({
      relPath: '/Jose Saramago/Letranger',
      media: { metadata: { title: 'Letranger', authorName: 'Jose Saramago' } }
    })]

    const decision = decideAbsMatches(books, items)

    expect(decision.foundIds.has('B004')).toBe(true)
    expect(decision.matches.get('B004')?.reason).toBe('title-subtitle-author')
  })

  it('uses folder plus author as a fallback signal', () => {
    const books = [makeBook({ id: 'B005', title: 'The Lost World: Book 1', author: 'Arthur Conan Doyle' })]
    const items = [makeAbsItem({
      relPath: '/Arthur Conan Doyle/The Lost World',
      media: { metadata: { title: 'Completely Different', authorName: 'Arthur Conan Doyle' } }
    })]

    const decision = decideAbsMatches(books, items)

    expect(decision.foundIds.has('B005')).toBe(true)
    expect(decision.matches.get('B005')?.reason).toBe('folder-author')
  })

  it('keeps recent downloads matched during ABS import lag', () => {
    const now = Date.parse('2026-04-29T12:00:00.000Z')
    const books = [makeBook({
      id: 'B006',
      title: 'Fresh Export',
      author: 'Author',
      isDownloaded: true,
      lastDownloadAt: '2026-04-29T11:50:00.000Z'
    })]

    const decision = decideAbsMatches(books, [], {
      now,
      recentDownloadGraceMs: 30 * 60 * 1000
    })

    expect(decision.foundIds.has('B006')).toBe(true)
    expect(decision.matches.get('B006')?.reason).toBe('recent-download-grace')
    expect(decision.shouldResetUnmatched).toBe(false)
  })
})
