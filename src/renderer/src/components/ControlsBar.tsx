import {
  ArrowDown, ArrowUp, Check, ChevronDown, Filter, LayoutGrid, List, Search, SlidersHorizontal, X, CheckSquare, Square
} from 'lucide-react'
import { SORT_OPTIONS } from '../types'
import { useFilterStore } from '../stores/useFilterStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useShallow } from 'zustand/react/shallow'

export function ControlsBar({ totalCount, currentCount, filteredBookIds }: { totalCount: number; currentCount: number; filteredBookIds: string[] }) {
  const {
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    secondarySortBy, setSecondarySortBy,
    secondarySortOrder, setSecondarySortOrder,
    showSortMenu, setShowSortMenu,
    showSecondarySortMenu, setShowSecondarySortMenu,
    setShowFilterPanel
  } = useFilterStore()

  const { selectedIds, selectAll, clearSelection } = useLibraryStore(
    useShallow(s => ({
      selectedIds: s.selectedIds,
      selectAll: s.selectAll,
      clearSelection: s.clearSelection
    }))
  )

  const allSelected = filteredBookIds.length > 0 && filteredBookIds.every(id => selectedIds.has(id))
  const someSelected = selectedIds.size > 0 && !allSelected

  const handleToggleSelectAll = () => {
    if (allSelected) clearSelection()
    else selectAll(filteredBookIds)
  }

  return (
    <div className="mb-8 flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-start">
          {/* Selection Toggle */}
          <button
            onClick={handleToggleSelectAll}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all sm:w-auto ${
              allSelected 
                ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' 
                : someSelected
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {allSelected ? 'All Selected' : someSelected ? `${selectedIds.size} Selected` : 'Select All'}
          </button>

          <div className="mx-1 hidden h-8 w-px bg-white/5 sm:block" />

          <div className="flex w-full rounded-2xl border border-white/[0.03] bg-black/20 p-1 sm:w-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 rounded-xl p-2.5 transition-all sm:flex-none ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 rounded-xl p-2.5 transition-all sm:flex-none ${viewMode === 'list' ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex w-full flex-1 group xl:max-w-2xl">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder={`Search ${currentCount} ${currentCount === 1 ? 'title' : 'titles'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a]/40 border border-slate-800/50 focus:border-amber-500/50 rounded-2xl py-3 pl-12 pr-12 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-4 flex items-center text-slate-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          {/* Main Sort */}
          <div className="relative group/sort w-full sm:w-auto">
            <button
              onClick={() => {
                setShowSecondarySortMenu(false)
                setShowSortMenu(!showSortMenu)
              }}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800/50 bg-[#0f172a]/40 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 transition-all hover:border-slate-700 hover:bg-[#0f172a]/60 active:scale-95 sm:w-auto sm:justify-start"
            >
              <SlidersHorizontal size={14} className="text-amber-500" />
              <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <div className="absolute top-full right-0 z-50 mt-3 w-full rounded-2xl border border-white/10 bg-[#0f172a] py-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 sm:w-56">
                <div className="px-4 py-2 mb-1 border-b border-white/5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sort By</span>
                </div>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value as any)
                      setShowSortMenu(false)
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === option.value ? 'bg-amber-500 text-black' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    {option.label}
                    {sortBy === option.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="rounded-2xl border border-slate-800/50 bg-[#0f172a]/40 p-3 text-slate-500 transition-all hover:border-slate-700 hover:text-amber-500"
            >
              {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>

            <div className="hidden h-8 w-px bg-white/5 sm:block" />

            {/* Secondary Sort Toggle */}
            <div className="relative group/sort flex-1 sm:flex-none">
              <button
                onClick={() => {
                  setShowSortMenu(false)
                  setShowSecondarySortMenu(!showSecondarySortMenu)
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800/50 bg-[#0f172a]/40 px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all hover:border-slate-700 hover:bg-[#0f172a]/60 active:scale-95 sm:w-auto sm:justify-start ${secondarySortBy ? 'border-amber-500/20 text-amber-400' : 'text-slate-500'}`}
              >
                <span>{secondarySortBy ? SORT_OPTIONS.find(o => o.value === secondarySortBy)?.label : 'Sub-Sort'}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${showSecondarySortMenu ? 'rotate-180' : ''}`} />
              </button>

              {showSecondarySortMenu && (
                <div className="absolute top-full right-0 z-50 mt-3 w-full rounded-2xl border border-white/10 bg-[#0f172a] py-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 sm:w-56">
                <div className="px-4 py-2 mb-1 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Secondary Sort</span>
                  {secondarySortBy && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSecondarySortBy('none'); setShowSecondarySortMenu(false) }}
                      className="text-[8px] text-amber-500 hover:text-white uppercase font-black"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSecondarySortBy(option.value as any)
                      setShowSecondarySortMenu(false)
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${secondarySortBy === option.value ? 'bg-amber-500 text-black' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    {option.label}
                    {secondarySortBy === option.value && <Check size={14} />}
                  </button>
                ))}
                </div>
              )}
            </div>

            {secondarySortBy && (
              <button
                onClick={() => setSecondarySortOrder(secondarySortOrder === 'asc' ? 'desc' : 'asc')}
                className="rounded-2xl border border-slate-800/50 bg-[#0f172a]/40 p-3 text-slate-500 transition-all hover:border-slate-700 hover:text-amber-500"
              >
                {secondarySortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
