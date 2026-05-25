import { useDeferredValue, useMemo } from 'react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useFilterStore } from '../stores/useFilterStore'
import { parseDurationToMinutes, compareField } from '../utils'
import { normalizeContributorName } from '../../../shared/index'

function splitContributors(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(/\s*,\s*/).map(part => part.trim()).filter(Boolean)
}

function normalizedContributors(value: string | null | undefined): string[] {
  return splitContributors(value).map(normalizeContributorName)
}

export function useFilteredBooks() {
  const books = useLibraryStore(s => s.books)
  const accounts = useLibraryStore(s => s.accounts)
  const detailsCache = useLibraryStore(s => s.detailsCache)
  const searchQuery = useFilterStore(s => s.searchQuery)
  const filter = useFilterStore(s => s.filter)
  const filterLibraryId = useFilterStore(s => s.filterLibraryId)
  const filterHasSeries = useFilterStore(s => s.filterHasSeries)
  const filterDurationMin = useFilterStore(s => s.filterDurationMin)
  const filterDurationMax = useFilterStore(s => s.filterDurationMax)
  const filterAuthors = useFilterStore(s => s.filterAuthors)
  const filterSeries = useFilterStore(s => s.filterSeries)
  const filterNarrators = useFilterStore(s => s.filterNarrators)
  const filterPublishers = useFilterStore(s => s.filterPublishers)
  const filterCategories = useFilterStore(s => s.filterCategories)
  const sortBy = useFilterStore(s => s.sortBy)
  const sortOrder = useFilterStore(s => s.sortOrder)
  const secondarySortBy = useFilterStore(s => s.secondarySortBy)
  const secondarySortOrder = useFilterStore(s => s.secondarySortOrder)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const visibleBooks = useMemo(() => {
    if (filter === 'ignored') return books.filter(b => b.isIgnored)
    return books.filter(b => !b.isIgnored)
  }, [books, filter])

  const uniqueAuthors = useMemo(
    () => [...new Set(visibleBooks.flatMap(b => normalizedContributors(b.author)))].sort(),
    [visibleBooks]
  )
  const libraryOptions = useMemo(() => {
    const accountMap = new Map(accounts.map((account: any) => [account.id, account]))
    return [...new Set(visibleBooks.map(b => b.accountId).filter(Boolean))]
      .map(accountId => {
        const account = accountMap.get(accountId)
        const label = account ? `${account.name} (${String(account.region).toUpperCase()})` : String(accountId)
        return { id: String(accountId), label }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [accounts, visibleBooks])
  const uniqueSeries = useMemo(
    () => [...new Set(visibleBooks.map(b => b.series).filter(Boolean))].sort() as string[],
    [visibleBooks]
  )
  const uniqueNarrators = useMemo(
    () => [...new Set(visibleBooks.flatMap(b => normalizedContributors(b.narrator)))].sort(),
    [visibleBooks]
  )
  const uniquePublishers = useMemo(
    () => [...new Set(visibleBooks.map(b => detailsCache[b.id]?.publisher).filter(Boolean))].sort() as string[],
    [detailsCache, visibleBooks]
  )
  const uniqueCategories = useMemo(
    () => [...new Set(visibleBooks.flatMap(b => detailsCache[b.id]?.categories || []))].sort(),
    [detailsCache, visibleBooks]
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filter !== 'all') count++
    if (filterLibraryId !== 'all') count++
    if (filterAuthors.size > 0) count += filterAuthors.size
    if (filterSeries.size > 0) count += filterSeries.size
    if (filterNarrators.size > 0) count += filterNarrators.size
    if (filterPublishers.size > 0) count += filterPublishers.size
    if (filterCategories.size > 0) count += filterCategories.size
    if (filterDurationMin !== null) count++
    if (filterDurationMax !== null) count++
    if (filterHasSeries !== 'all') count++
    return count
  }, [filter, filterLibraryId, filterAuthors, filterSeries, filterNarrators, filterPublishers, filterCategories, filterDurationMin, filterDurationMax, filterHasSeries])

  const filteredBooks = useMemo(() => {
    let result = filter === 'ignored' ? books.filter(b => b.isIgnored) : books.filter(b => !b.isIgnored)

    if (filter === 'synced') result = result.filter(b => b.isInAbs)
    if (filter === 'pending') result = result.filter(b => !b.isInAbs)
    if (filterLibraryId !== 'all') result = result.filter(b => b.accountId === filterLibraryId)
    if (filterAuthors.size > 0) result = result.filter(b => normalizedContributors(b.author).some(author => filterAuthors.has(author)))
    if (filterSeries.size > 0) result = result.filter(b => b.series != null && filterSeries.has(b.series))
    if (filterNarrators.size > 0) result = result.filter(b => normalizedContributors(b.narrator).some(narrator => filterNarrators.has(narrator)))
    if (filterPublishers.size > 0) result = result.filter(b => {
      const publisher = detailsCache[b.id]?.publisher
      return Boolean(publisher && filterPublishers.has(publisher))
    })
    if (filterCategories.size > 0) result = result.filter(b => {
      const categories = detailsCache[b.id]?.categories || []
      return categories.some(category => filterCategories.has(category))
    })
    if (filterHasSeries === 'yes') result = result.filter(b => b.series)
    else if (filterHasSeries === 'no') result = result.filter(b => !b.series)

    if (filterDurationMin !== null || filterDurationMax !== null) {
      result = result.filter(b => {
        const mins = parseDurationToMinutes(b.duration)
        if (mins === null) return false
        if (filterDurationMin !== null && mins < filterDurationMin * 60) return false
        if (filterDurationMax !== null && mins > filterDurationMax * 60) return false
        return true
      })
    }

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase()
      result = result.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          normalizedContributors(b.author).some(author => author.toLowerCase().includes(q)) ||
          (b.series && b.series.toLowerCase().includes(q)) ||
          (b.narrator && b.narrator.toLowerCase().includes(q)) ||
          normalizedContributors(b.narrator).some(narrator => narrator.toLowerCase().includes(q)) ||
          (detailsCache[b.id]?.publisher && detailsCache[b.id].publisher.toLowerCase().includes(q)) ||
          (detailsCache[b.id]?.categories || []).some(category => category.toLowerCase().includes(q))
      )
    }

    result.sort((a, b) => {
      const primary = compareField(a, b, sortBy, sortOrder)
      if (primary !== 0) return primary
      if (secondarySortBy !== 'none') {
        const secondary = compareField(a, b, secondarySortBy, secondarySortOrder)
        if (secondary !== 0) return secondary
      }
      return a.title.localeCompare(b.title)
    })

    return result
  }, [books, detailsCache, deferredSearchQuery, filter, filterLibraryId, sortBy, sortOrder, secondarySortBy, secondarySortOrder, filterAuthors, filterSeries, filterNarrators, filterPublishers, filterCategories, filterDurationMin, filterDurationMax, filterHasSeries])

  return {
    visibleBooks,
    libraryOptions,
    uniqueAuthors,
    uniqueSeries,
    uniqueNarrators,
    uniquePublishers,
    uniqueCategories,
    activeFilterCount,
    filteredBooks,
  }
}
