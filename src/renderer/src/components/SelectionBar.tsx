import { Download, RefreshCw, EyeOff, X, CheckSquare, Square } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useShallow } from 'zustand/react/shallow'
import { Book } from '../types'

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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-amber-500/30 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(245,158,11,0.1)] px-6 py-4 flex items-center gap-8 min-w-[500px]">
        <div className="flex items-center gap-4 border-r border-white/10 pr-6">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20">
            {selectedCount}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-widest text-white">Titles Selected</span>
            <button 
              onClick={clearSelection}
              className="text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1 mt-0.5"
            >
              <X size={10} /> Clear Selection
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadSelected}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 hover:border-white/20 active:scale-95"
          >
            <Download size={14} className="text-amber-500" /> Download
          </button>
          
          <button
            onClick={onRescanSelected}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 hover:border-white/20 active:scale-95"
          >
            <RefreshCw size={14} className="text-amber-500" /> Rescan
          </button>

          <button
            onClick={onHideSelected}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 hover:border-white/20 active:scale-95"
          >
            <EyeOff size={14} className="text-amber-500" /> Hide
          </button>
        </div>

        <button
          onClick={clearSelection}
          className="ml-2 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
