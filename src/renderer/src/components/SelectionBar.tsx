import { Download, RefreshCw, EyeOff, X } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useShallow } from 'zustand/react/shallow'

export function SelectionBar() {
  const { selectedIds, books, clearSelection, addManyToQueue, handleRescanMany, handleToggleIgnore } = useLibraryStore(
    useShallow(s => ({
      selectedIds: s.selectedIds,
      books: s.books,
      clearSelection: s.clearSelection,
      addManyToQueue: s.addManyToQueue,
      handleRescanMany: s.handleRescanMany,
      handleToggleIgnore: s.handleToggleIgnore
    }))
  )

  if (selectedIds.size === 0) return null

  const selectedCount = selectedIds.size
  const selectedBooks = books.filter(b => selectedIds.has(b.id))

  const onDownloadSelected = () => {
    addManyToQueue(Array.from(selectedIds))
    clearSelection()
  }

  const onRescanSelected = async () => {
    await handleRescanMany(Array.from(selectedIds))
    clearSelection()
  }

  const onHideSelected = async () => {
    for (const book of selectedBooks) {
      if (!book.isIgnored) {
        await handleToggleIgnore(book)
      }
    }
    clearSelection()
  }

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300 lg:bottom-8 lg:w-auto">
      <div className="flex items-center gap-3 rounded-3xl border border-amber-500/30 bg-[#0f172a]/80 px-3 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(245,158,11,0.1)] backdrop-blur-2xl lg:px-6 lg:py-4">
        <div className="flex shrink-0 items-center gap-2.5 border-r border-white/10 pr-3 lg:pr-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500 text-sm font-black text-black shadow-lg shadow-amber-500/20 lg:h-10 lg:w-10">
            {selectedCount}
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-[11px] font-black uppercase tracking-widest text-white">Selected</span>
            <button
              onClick={clearSelection}
              className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
            >
              <X size={10} /> Clear
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto custom-scrollbar lg:gap-3">
          <SelectionAction icon={<Download size={14} className="text-amber-500" />} label="Download" onClick={onDownloadSelected} />
          <SelectionAction icon={<RefreshCw size={14} className="text-amber-500" />} label="Rescan" onClick={onRescanSelected} />
          <SelectionAction icon={<EyeOff size={14} className="text-amber-500" />} label="Hide" onClick={onHideSelected} />
        </div>

        <button
          onClick={clearSelection}
          aria-label="Clear selection"
          className="shrink-0 rounded-xl p-2 text-slate-500 transition-all hover:bg-white/5 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

function SelectionAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-white/20 hover:bg-white/10 active:scale-95 lg:px-4 lg:py-2.5"
    >
      {icon} {label}
    </button>
  )
}
