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
    <div className="flex flex-col gap-5 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          {/* Selection Toggle */}
          <button
            onClick={handleToggleSelectAll}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
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

          <div className="h-8 w-px bg-white/5 mx-1" />

          <div className="flex bg-black/20 p-1 rounded-2xl border border-white/[0.03]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 max-w-2xl relative group">
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

        <div className="flex items-center gap-2">
          {/* Main Sort */}
          <div className="relative group/sort">
            <button
              onClick={() => {
                setShowSecondarySortMenu(false)
                setShowSortMenu(!showSortMenu)
              }}
              className="flex items-center gap-3 bg-[#0f172a]/40 border border-slate-800/50 hover:border-slate-700 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-[#0f172a]/60 active:scale-95"
            >
              <SlidersHorizontal size={14} className="text-amber-500" />
              <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <div className="absolute top-full right-0 mt-3 w-56 bg-[#0f172a] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
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

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-3 bg-[#0f172a]/40 border border-slate-800/50 hover:border-slate-700 rounded-2xl text-slate-500 hover:text-amber-500 transition-all"
          >
            {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>

          <div className="h-8 w-px bg-white/5 mx-1" />

          {/* Secondary Sort Toggle */}
          <div className="relative group/sort">
            <button
              onClick={() => {
                setShowSortMenu(false)
                setShowSecondarySortMenu(!showSecondarySortMenu)
              }}
              className={`flex items-center gap-3 bg-[#0f172a]/40 border border-slate-800/50 hover:border-slate-700 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-[#0f172a]/60 active:scale-95 ${secondarySortBy ? 'text-amber-400 border-amber-500/20' : 'text-slate-500'}`}
            >
              <span>{secondarySortBy ? SORT_OPTIONS.find(o => o.value === secondarySortBy)?.label : 'Sub-Sort'}</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${showSecondarySortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSecondarySortMenu && (
              <div className="absolute top-full right-0 mt-3 w-56 bg-[#0f172a] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
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
              className="p-3 bg-[#0f172a]/40 border border-slate-800/50 hover:border-slate-700 rounded-2xl text-slate-500 hover:text-amber-500 transition-all"
            >
              {secondarySortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
