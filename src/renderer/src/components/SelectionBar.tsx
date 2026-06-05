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
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-8 sm:w-auto">
      <div className="flex flex-col gap-4 rounded-3xl border border-amber-500/30 bg-[#0f172a]/80 px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(245,158,11,0.1)] backdrop-blur-2xl sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <div className="flex items-center gap-4 border-b border-white/10 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
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

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <button
            onClick={onDownloadSelected}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-white/20 hover:bg-white/10 active:scale-95 sm:w-auto"
          >
            <Download size={14} className="text-amber-500" /> Download
          </button>
          
          <button
            onClick={onRescanSelected}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-white/20 hover:bg-white/10 active:scale-95 sm:w-auto"
          >
            <RefreshCw size={14} className="text-amber-500" /> Rescan
          </button>

          <button
            onClick={onHideSelected}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-white/20 hover:bg-white/10 active:scale-95 sm:w-auto"
          >
            <EyeOff size={14} className="text-amber-500" /> Hide
          </button>
        </div>

        <button
          onClick={clearSelection}
          className="self-end rounded-xl p-2 text-slate-500 transition-all hover:bg-white/5 hover:text-white sm:ml-auto sm:self-auto"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
