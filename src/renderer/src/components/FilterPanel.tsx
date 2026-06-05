import { Check, Filter, X } from 'lucide-react'
import { useFilterStore } from '../stores/useFilterStore'
import { useFilteredBooks } from '../hooks/useFilteredBooks'

export function FilterPanel() {
  const filter = useFilterStore(s => s.filter)
  const setFilter = useFilterStore(s => s.setFilter)
  const filterLibraryId = useFilterStore(s => s.filterLibraryId)
  const setFilterLibraryId = useFilterStore(s => s.setFilterLibraryId)
  const filterHasSeries = useFilterStore(s => s.filterHasSeries)
  const setFilterHasSeries = useFilterStore(s => s.setFilterHasSeries)
  const filterHasSilent = useFilterStore(s => s.filterHasSilent)
  const setFilterHasSilent = useFilterStore(s => s.setFilterHasSilent)
  const filterDurationMin = useFilterStore(s => s.filterDurationMin)
  const setFilterDurationMin = useFilterStore(s => s.setFilterDurationMin)
  const filterDurationMax = useFilterStore(s => s.filterDurationMax)
  const setFilterDurationMax = useFilterStore(s => s.setFilterDurationMax)
  const filterAuthors = useFilterStore(s => s.filterAuthors)
  const toggleAuthor = useFilterStore(s => s.toggleAuthor)
  const filterSeries = useFilterStore(s => s.filterSeries)
  const toggleSeries = useFilterStore(s => s.toggleSeries)
  const filterNarrators = useFilterStore(s => s.filterNarrators)
  const toggleNarrator = useFilterStore(s => s.toggleNarrator)
  const filterPublishers = useFilterStore(s => s.filterPublishers)
  const togglePublisher = useFilterStore(s => s.togglePublisher)
  const filterCategories = useFilterStore(s => s.filterCategories)
  const toggleCategory = useFilterStore(s => s.toggleCategory)
  const authorSearch = useFilterStore(s => s.authorSearch)
  const setAuthorSearch = useFilterStore(s => s.setAuthorSearch)
  const seriesSearch = useFilterStore(s => s.seriesSearch)
  const setSeriesSearch = useFilterStore(s => s.setSeriesSearch)
  const narratorSearch = useFilterStore(s => s.narratorSearch)
  const setNarratorSearch = useFilterStore(s => s.setNarratorSearch)
  const publisherSearch = useFilterStore(s => s.publisherSearch)
  const setPublisherSearch = useFilterStore(s => s.setPublisherSearch)
  const categorySearch = useFilterStore(s => s.categorySearch)
  const setCategorySearch = useFilterStore(s => s.setCategorySearch)
  const clearAllFilters = useFilterStore(s => s.clearAllFilters)
  const setShowFilterPanel = useFilterStore(s => s.setShowFilterPanel)

  const { activeFilterCount, libraryOptions, uniqueAuthors, uniqueSeries, uniqueNarrators, uniquePublishers, uniqueCategories } = useFilteredBooks()

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-800/60 bg-[#0f172a]/95 shadow-2xl backdrop-blur-xl pb-safe lg:rounded-3xl lg:border lg:pb-0 lg:animate-in lg:fade-in lg:slide-in-from-right-4 lg:duration-300">
      {/* Mobile drag handle */}
      <div className="flex shrink-0 justify-center pt-3 pb-1 lg:hidden">
        <div className="h-1.5 w-12 rounded-full bg-white/15" />
      </div>
      <div className="shrink-0 p-4 lg:p-5 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Filter size={16} className="text-amber-500" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <span className="bg-amber-500/10 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-500/20">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors px-3 py-1.5 hover:bg-rose-500/10 rounded-lg"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setShowFilterPanel(false)}
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-5 custom-scrollbar">
        <div className="grid grid-cols-1 gap-4">
          {/* Status */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Status</label>
            <div className="flex gap-1 p-1 bg-black/20 rounded-xl">
              {([
                ['all', 'All'],
                ['synced', 'In ABS'],
                ['pending', 'Missing ABS'],
                ['ignored', 'Ignored']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`flex-1 px-1 py-2 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                    filter === value ? 'bg-amber-500 text-[#020617] shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Library */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Library Source</label>
            <select
              value={filterLibraryId}
              onChange={e => setFilterLibraryId(e.target.value)}
              className="w-full bg-black/20 border border-slate-800/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/40 transition-all"
              style={{ backgroundColor: '#0b1120', color: '#e2e8f0' }}
            >
              <option value="all" style={{ backgroundColor: '#0b1120', color: '#e2e8f0' }}>All Libraries</option>
              {libraryOptions.map(option => (
                <option key={option.id} value={option.id} style={{ backgroundColor: '#0b1120', color: '#e2e8f0' }}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Has Series */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Series</label>
            <div className="flex gap-1 p-1 bg-black/20 rounded-xl">
              {([['all', 'All'], ['yes', 'Has Series'], ['no', 'No Series']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterHasSeries(val)}
                  className={`flex-1 px-1 py-2 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                    filterHasSeries === val ? 'bg-amber-500 text-[#020617] shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Azure Silent Files */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Azure Silent Files</label>
            <div className="flex gap-1 p-1 bg-black/20 rounded-xl">
              {([['all', 'All'], ['yes', 'Has Silent'], ['no', 'No Silent']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterHasSilent(val)}
                  className={`flex-1 px-1 py-2 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                    filterHasSilent === val ? 'bg-amber-500 text-[#020617] shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Range */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Duration (hours)</label>
            <div className="flex gap-3 items-center">
              <input
                type="number"
                min={0}
                step={1}
                value={filterDurationMin ?? ''}
                onChange={e => setFilterDurationMin(e.target.value ? Number(e.target.value) : null)}
                placeholder="Min"
                className="flex-1 bg-black/20 border border-slate-800/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all"
              />
              <span className="text-slate-600 text-xs font-bold">to</span>
              <input
                type="number"
                min={0}
                step={1}
                value={filterDurationMax ?? ''}
                onChange={e => setFilterDurationMax(e.target.value ? Number(e.target.value) : null)}
                placeholder="Max"
                className="flex-1 bg-black/20 border border-slate-800/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all"
              />
            </div>
          </div>

          {/* Author multi-select */}
          <MultiSelect
            label="Author"
            items={uniqueAuthors}
            selected={filterAuthors}
            onToggle={toggleAuthor}
            search={authorSearch}
            onSearchChange={setAuthorSearch}
            emptyText="No authors found"
          />

          {/* Series multi-select */}
          <MultiSelect
            label="Series Name"
            items={uniqueSeries}
            selected={filterSeries}
            onToggle={toggleSeries}
            search={seriesSearch}
            onSearchChange={setSeriesSearch}
            emptyText="No series found"
          />

          {/* Narrator multi-select */}
          <MultiSelect
            label="Narrator"
            items={uniqueNarrators}
            selected={filterNarrators}
            onToggle={toggleNarrator}
            search={narratorSearch}
            onSearchChange={setNarratorSearch}
            emptyText="No narrators found"
          />

          <MultiSelect
            label="Publisher"
            items={uniquePublishers}
            selected={filterPublishers}
            onToggle={togglePublisher}
            search={publisherSearch}
            onSearchChange={setPublisherSearch}
            emptyText="No publishers found"
          />

          <MultiSelect
            label="Category"
            items={uniqueCategories}
            selected={filterCategories}
            onToggle={toggleCategory}
            search={categorySearch}
            onSearchChange={setCategorySearch}
            emptyText="No categories found"
          />
        </div>
      </div>
    </div>
  )
}

interface MultiSelectProps {
  label: string
  items: string[]
  selected: Set<string>
  onToggle: (item: string) => void
  search: string
  onSearchChange: (q: string) => void
  emptyText: string
}

function MultiSelect({ label, items, selected, onToggle, search, onSearchChange, emptyText }: MultiSelectProps) {
  const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
        <span>{label}</span>
        {selected.size > 0 && <span className="text-amber-400">{selected.size} selected</span>}
      </label>
      <input
        type="text"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={`Search ${label.toLowerCase()}s...`}
        className="w-full bg-black/20 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all"
      />
      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5 bg-black/10 rounded-xl p-1">
        {filtered.map(item => (
          <button
            key={item}
            onClick={() => onToggle(item)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all text-left ${
              selected.has(item) ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
              selected.has(item) ? 'bg-amber-500 border-amber-500' : 'border-slate-700'
            }`}>
              {selected.has(item) && <Check size={10} className="text-black" />}
            </div>
            <span className="truncate">{item}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[10px] text-slate-600 text-center py-3 font-bold">{emptyText}</p>
        )}
      </div>
    </div>
  )
}
