import { describe, expect, it } from 'vitest'
import type { Book } from '../../shared/schemas'
import { mergeBooksForSave } from '../bookPersistence'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'B001',
    title: 'Test Book',
    author: 'Test Author',
    narrator: 'Test Narrator',
    series: null,
    duration: '1 hr',
    purchaseDate: null,
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

describe('mergeBooksForSave', () => {
  it('preserves local state for existing books', () => {
    const existing = new Map<string, Book>([
      ['B001', makeBook({ isDownloaded: true, isInAbs: true, isIgnored: true, lastDownloadAt: '2026-04-29T00:00:00.000Z' })]
    ])

    const merged = mergeBooksForSave(existing, [makeBook({ title: 'Updated Title' })])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: 'B001',
      title: 'Updated Title',
      isDownloaded: true,
      isInAbs: true,
      isIgnored: true,
      lastDownloadAt: '2026-04-29T00:00:00.000Z'
    })
  })

  it('keeps existing books when a scrape result is incomplete', () => {
    const existing = new Map<string, Book>([
      ['B001', makeBook({ id: 'B001', title: 'Book One' })],
      ['B002', makeBook({ id: 'B002', title: 'Book Two', isDownloaded: true })]
    ])

    const merged = mergeBooksForSave(existing, [makeBook({ id: 'B001', title: 'Book One Updated' })])

    expect(merged.map(book => book.id).sort()).toEqual(['B001', 'B002'])
    expect(merged.find(book => book.id === 'B002')?.isDownloaded).toBe(true)
  })

  it('can prune missing books when explicitly requested', () => {
    const existing = new Map<string, Book>([
      ['B001', makeBook({ id: 'B001' })],
      ['B002', makeBook({ id: 'B002' })]
    ])

    const merged = mergeBooksForSave(existing, [makeBook({ id: 'B001' })], { pruneMissing: true })

    expect(merged.map(book => book.id)).toEqual(['B001'])
  })

  it('preserves accountId when merging', () => {
    const existing = new Map<string, Book>([
      ['B001', makeBook({ id: 'B001', accountId: 'acc1' })]
    ])

    const merged = mergeBooksForSave(existing, [makeBook({ id: 'B001' })])

    expect(merged[0].accountId).toBe('acc1')

    const mergedWithNewAccount = mergeBooksForSave(existing, [makeBook({ id: 'B001', accountId: 'acc2' })])
    expect(mergedWithNewAccount[0].accountId).toBe('acc2')
  })

  it('preserves purchaseDate from previous data when incoming data omits it', () => {
    const existing = new Map<string, Book>([
      ['B001', makeBook({ id: 'B001', purchaseDate: '2026-05-01T00:00:00.000Z' })]
    ])

    const merged = mergeBooksForSave(existing, [makeBook({ id: 'B001', purchaseDate: null })])

    expect(merged[0].purchaseDate).toBe('2026-05-01T00:00:00.000Z')
  })

  it('backfills purchaseDate from addedDate when needed', () => {
    const merged = mergeBooksForSave(new Map(), [
      makeBook({ id: 'B001', purchaseDate: null, addedDate: '2026-05-02T00:00:00.000Z' })
    ])

    expect(merged[0].purchaseDate).toBe('2026-05-02T00:00:00.000Z')
  })
})
