import { RefObject, memo, useMemo, useState, useEffect, useRef } from 'react'
import { BookOpen, CheckCircle2, Clock, Download, HardDrive, RefreshCw, MoreVertical, EyeOff, Eye } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useVirtualViewport } from '../hooks/useVirtualViewport'
import { Book } from '../types'
import { useShallow } from 'zustand/react/shallow'
import { normalizeContributorName } from '../../../shared/index'

const GRID_GAP = 24
const GRID_CARD_META_HEIGHT = 150

export function LibraryGrid({
  books,
  scrollContainerRef
}: {
  books: Book[]
  scrollContainerRef: RefObject<HTMLElement | null>
}) {
  const detailsCache = useLibraryStore(s => s.detailsCache)
  const setSelectedBook = useLibraryStore(s => s.setSelectedBook)
  const { scrollTop, viewportHeight } = useVirtualViewport(scrollContainerRef, { overscanPx: 1200 })

  const containerRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.clientWidth)
      }
    }

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(containerRef.current)
    updateWidth()

    return () => resizeObserver.disconnect()
  }, [])

  const columns = gridWidth >= 1536 ? 7 : gridWidth >= 1280 ? 5 : gridWidth >= 1024 ? 4 : gridWidth >= 768 ? 3 : 2
  const itemWidth = Math.max(0, (gridWidth - (columns - 1) * GRID_GAP) / columns)
  const rowHeight = itemWidth + GRID_CARD_META_HEIGHT
  const totalRows = Math.ceil(books.length / columns)
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight))
  const visibleRowCount = Math.max(1, Math.ceil(viewportHeight / rowHeight))
  const endRow = Math.min(totalRows, startRow + visibleRowCount)

  const visibleItems = useMemo(() => {
    const items: Array<{ book: Book; index: number }> = []
    for (let row = startRow; row < endRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col
        if (index >= books.length) break
        items.push({ book: books[index], index })
      }
    }
    return items
  }, [books, columns, endRow, startRow])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: `${totalRows * rowHeight}px` }}>
      {visibleItems.map(({ book, index }) => {
        const row = Math.floor(index / columns)
        const col = index % columns
        return (
          <div
            key={book.id}
            className="absolute"
            style={{
              top: `${row * rowHeight}px`,
              left: `${col * (itemWidth + GRID_GAP)}px`,
              width: `${itemWidth}px`
            }}
          >
            <LibraryGridItem book={book} details={detailsCache[book.id]} onSelect={setSelectedBook} />
          </div>
        )
      })}
    </div>
  )
}

const formatSpeed = (bytesPerSec?: number) => {
  if (!bytesPerSec || bytesPerSec <= 0) return ''
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

const LibraryGridItem = memo(function LibraryGridItem({
  book,
  details,
  onSelect
}: {
  book: Book
  details: { seriesSequence?: string } | undefined
  onSelect: (book: Book) => void
}) {
  const handleDownload = useLibraryStore(s => s.handleDownload)
  const handleRescan = useLibraryStore(s => s.handleRescan)
  const handleToggleIgnore = useLibraryStore(s => s.handleToggleIgnore)
  const toggleSelection = useLibraryStore(s => s.toggleSelection)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { isDownloading, isQueued, progress, speed, phase, isSelected } = useLibraryStore(useShallow(s => ({
    isDownloading: s.downloadingIds.has(book.id),
    isQueued: s.queue.some(q => q.bookId === book.id && q.status === 'queued'),
    progress: s.downloadProgress[book.id] || 0,
    speed: s.downloadSpeed[book.id],
    phase: s.downloadPhase[book.id],
    isSelected: s.selectedIds.has(book.id)
  })))

  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const seriesBadge = book.series && (book.seriesSequence || details?.seriesSequence)
    ? `#${book.seriesSequence || details?.seriesSequence}`
    : null

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation()
      toggleSelection(book.id)
    } else {
      onSelect(book)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group relative bg-[#0f172a]/30 rounded-[2rem] overflow-hidden border transition-all duration-500 hover:shadow-3xl hover:shadow-amber-500/5 hover:-translate-y-2 cursor-pointer ${
        isSelected ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/20' : 'border-slate-800/40 hover:border-amber-500/30'
      }`}
    >
      <div className="aspect-square relative overflow-hidden m-2 rounded-[1.6rem]">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isSelected ? 'scale-105' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <BookOpen size={40} className="text-slate-800" />
          </div>
        )}

        {/* Selection Checkbox */}
        <div 
          onClick={(e) => { e.stopPropagation(); toggleSelection(book.id) }}
          className={`absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all duration-300 ${
            isSelected 
              ? 'bg-amber-500 border-amber-500 text-black scale-110 shadow-lg' 
              : 'bg-black/40 border-white/20 text-transparent opacity-100 hover:border-white/40 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
        >
          <CheckCircle2 size={14} className={isSelected ? 'opacity-100' : 'opacity-0'} />
        </div>

        <div className="absolute left-3 top-3 z-20 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100">
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
              className="p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-black/80 transition-all"
            >
              <MoreVertical size={16} />
            </button>
            
            {showMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-[#0f172a] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleRescan(book.id) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 hover:text-amber-400 transition-all border-b border-white/5"
                >
                  <RefreshCw size={14} /> Rescan Title
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleToggleIgnore(book) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 hover:text-red-400 transition-all"
                >
                  {book.isIgnored ? <><Eye size={14} /> Show Title</> : <><EyeOff size={14} /> Hide Title</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {!isDownloading && !isQueued && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-100 transition-all duration-500 sm:opacity-0 sm:group-hover:opacity-100">
            <div className="mt-auto w-full flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); handleDownload(book) }}
                className="flex-1 bg-white text-black py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors shadow-2xl"
              >
                {book.isDownloaded ? <><RefreshCw size={14} /> Sync</> : <><Download size={14} /> Download</>}
              </button>
            </div>
          </div>
        )}

        {isQueued && !isDownloading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <Clock size={12} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Queued</span>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-2 pointer-events-none">
          {book.isDownloaded && (
            <div className="bg-emerald-500/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-emerald-400/20">
              <HardDrive size={12} className="text-white" />
            </div>
          )}
          {book.isInAbs && (
            <div className="bg-sky-500/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-sky-400/20">
              <CheckCircle2 size={12} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {isDownloading && (
        <div className="mx-4 mb-1 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{phase === 'convert' ? 'Converting' : 'Downloading'}</span>
            <div className="flex items-center gap-2">
              {phase !== 'convert' && speed && speed > 0 && (
                <span className="text-[9px] font-black text-amber-500/60 tabular-nums">{formatSpeed(speed)}</span>
              )}
              <span className="text-[9px] font-black text-slate-400">{progress}%</span>
            </div>
          </div>
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="p-5 pt-3">
        <h3 className="font-black text-[13px] text-white leading-tight line-clamp-2 mb-1.5 group-hover:text-amber-400 transition-colors duration-300">
          {book.title}
        </h3>
        <p className="text-[11px] text-slate-500 font-bold line-clamp-1 mb-3">{normalizeContributorName(book.author)}</p>
        {(book.series || seriesBadge) && (
          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
            {book.series && (
              <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] max-w-full">
                <span className="text-[9px] text-slate-600 font-black uppercase tracking-tighter line-clamp-1">{book.series}</span>
              </div>
            )}
            {seriesBadge && (
              <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest">{seriesBadge}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
