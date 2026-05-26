import { create } from 'zustand'
import { SORT_OPTIONS, SortField } from '../types'

interface FilterState {
  searchQuery: string
  filter: 'all' | 'synced' | 'pending' | 'ignored'
  filterLibraryId: 'all' | string
  filterHasSeries: 'all' | 'yes' | 'no'
  filterHasSilent: 'all' | 'yes' | 'no'
  filterDurationMin: number | null
  filterDurationMax: number | null
  filterAuthors: Set<string>
  filterSeries: Set<string>
  filterNarrators: Set<string>
  filterPublishers: Set<string>
  filterCategories: Set<string>
  authorSearch: string
  seriesSearch: string
  narratorSearch: string
  publisherSearch: string
  categorySearch: string
  showFilterPanel: boolean
  sortBy: SortField
  sortOrder: 'asc' | 'desc'
  secondarySortBy: 'none' | SortField
  secondarySortOrder: 'asc' | 'desc'
  showSortMenu: boolean
  showSecondarySortMenu: boolean
  viewMode: 'grid' | 'list'
  viewStyle: 'grid' | 'list'

  setSearchQuery: (q: string) => void
  setFilter: (f: 'all' | 'synced' | 'pending' | 'ignored') => void
  setFilterLibraryId: (id: 'all' | string) => void
  setFilterHasSeries: (f: 'all' | 'yes' | 'no') => void
  setFilterHasSilent: (f: 'all' | 'yes' | 'no') => void
  setFilterDurationMin: (v: number | null) => void
  setFilterDurationMax: (v: number | null) => void
  toggleAuthor: (a: string) => void
  toggleSeries: (s: string) => void
  toggleNarrator: (n: string) => void
  togglePublisher: (p: string) => void
  toggleCategory: (c: string) => void
  setAuthorSearch: (q: string) => void
  setSeriesSearch: (q: string) => void
  setNarratorSearch: (q: string) => void
  setPublisherSearch: (q: string) => void
  setCategorySearch: (q: string) => void
  setShowFilterPanel: (v: boolean | ((prev: boolean) => boolean)) => void
  setSortBy: (f: SortField) => void
  setSortOrder: (o: 'asc' | 'desc') => void
  setSecondarySortBy: (f: 'none' | SortField) => void
  setSecondarySortOrder: (o: 'asc' | 'desc') => void
  setShowSortMenu: (v: boolean | ((prev: boolean) => boolean)) => void
  setShowSecondarySortMenu: (v: boolean | ((prev: boolean) => boolean)) => void
  setViewMode: (v: 'grid' | 'list') => void
  setViewStyle: (v: 'grid' | 'list') => void
  clearAllFilters: () => void
  getSortLabel: (value: string) => string
}

function toggleSetItem(set: Set<string>, item: string): Set<string> {
  const next = new Set(set)
  next.has(item) ? next.delete(item) : next.add(item)
  return next
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  filter: 'all',
  filterLibraryId: 'all',
  filterHasSeries: 'all',
  filterHasSilent: 'all',
  filterDurationMin: null,
  filterDurationMax: null,
  filterAuthors: new Set(),
  filterSeries: new Set(),
  filterNarrators: new Set(),
  filterPublishers: new Set(),
  filterCategories: new Set(),
  authorSearch: '',
  seriesSearch: '',
  narratorSearch: '',
  publisherSearch: '',
  categorySearch: '',
  showFilterPanel: false,
  sortBy: 'purchaseDate',
  sortOrder: 'desc',
  secondarySortBy: 'none',
  secondarySortOrder: 'asc',
  showSortMenu: false,
  showSecondarySortMenu: false,
  viewMode: 'grid',
  viewStyle: 'grid',

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),
  setFilterLibraryId: (filterLibraryId) => set({ filterLibraryId }),
  setFilterHasSeries: (f) => set({ filterHasSeries: f }),
  setFilterHasSilent: (f) => set({ filterHasSilent: f }),
  setFilterDurationMin: (v) => set({ filterDurationMin: v }),
  setFilterDurationMax: (v) => set({ filterDurationMax: v }),
  toggleAuthor: (a) => set(s => ({ filterAuthors: toggleSetItem(s.filterAuthors, a) })),
  toggleSeries: (s) => set(st => ({ filterSeries: toggleSetItem(st.filterSeries, s) })),
  toggleNarrator: (n) => set(s => ({ filterNarrators: toggleSetItem(s.filterNarrators, n) })),
  togglePublisher: (p) => set(s => ({ filterPublishers: toggleSetItem(s.filterPublishers, p) })),
  toggleCategory: (c) => set(s => ({ filterCategories: toggleSetItem(s.filterCategories, c) })),
  setAuthorSearch: (q) => set({ authorSearch: q }),
  setSeriesSearch: (q) => set({ seriesSearch: q }),
  setNarratorSearch: (q) => set({ narratorSearch: q }),
  setPublisherSearch: (q) => set({ publisherSearch: q }),
  setCategorySearch: (q) => set({ categorySearch: q }),
  setShowFilterPanel: (v) => set(s => ({ showFilterPanel: typeof v === 'function' ? v(s.showFilterPanel) : v })),
  setSortBy: (f) => set({ sortBy: f }),
  setSortOrder: (o) => set({ sortOrder: o }),
  setSecondarySortBy: (f) => set({ secondarySortBy: f }),
  setSecondarySortOrder: (o) => set({ secondarySortOrder: o }),
  setShowSortMenu: (v) => set(s => ({ showSortMenu: typeof v === 'function' ? v(s.showSortMenu) : v })),
  setShowSecondarySortMenu: (v) => set(s => ({ showSecondarySortMenu: typeof v === 'function' ? v(s.showSecondarySortMenu) : v })),
  setViewMode: (v) => set({ viewMode: v, viewStyle: v }),
  setViewStyle: (v) => set({ viewMode: v, viewStyle: v }),

  clearAllFilters: () => set({
    filter: 'all',
    filterLibraryId: 'all',
    filterAuthors: new Set(),
    filterSeries: new Set(),
    filterNarrators: new Set(),
    filterPublishers: new Set(),
    filterCategories: new Set(),
    filterDurationMin: null,
    filterDurationMax: null,
    filterHasSeries: 'all',
    filterHasSilent: 'all',
    searchQuery: '',
    authorSearch: '',
    seriesSearch: '',
    narratorSearch: '',
    publisherSearch: '',
    categorySearch: '',
  }),

  getSortLabel: (value) => SORT_OPTIONS.find(o => o.value === value)?.label ?? value,
}))
