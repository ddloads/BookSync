import { CSSProperties, RefObject, memo, useMemo } from 'react'
import { BookOpen, CheckCircle2, Clock, Download, HardDrive, RefreshCw } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { Book, BookDetails } from '../types'
import { useVirtualViewport } from '../hooks/useVirtualViewport'
import { formatDurationDisplay, parseAudibleDate } from '../utils'
import { useShallow } from 'zustand/react/shallow'
import { normalizeContributorName } from '../../../shared/index'

const ROW_HEIGHT = 88
const ROW_GAP = 8
const VIRTUAL_ROW_SIZE = ROW_HEIGHT + ROW_GAP

export function LibraryList({
  books,
  scrollContainerRef
}: {
  books: Book[]
  scrollContainerRef: RefObject<HTMLElement | null>
}) {
  const detailsCache = useLibraryStore(s => s.detailsCache)
  const setSelectedBook = useLibraryStore(s => s.setSelectedBook)
  const { scrollTop, viewportHeight } = useVirtualViewport(scrollContainerRef, { overscanPx: VIRTUAL_ROW_SIZE * 6 })

  const narratorWidth = useMemo(() => {
    const maxNarratorLength = Math.max(...books.map(b => (b.narrator || '--').length), 10)
    return `${Math.min(Math.max(maxNarratorLength, 15), 35)}ch`
  }, [books])

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `32px minmax(0, 3fr) ${narratorWidth} minmax(0, 2fr) 90px 90px 60px`,
    gap: '1rem',
    alignItems: 'center'
  } as const

  const totalHeight = books.length * VIRTUAL_ROW_SIZE
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_SIZE))
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / VIRTUAL_ROW_SIZE))
  const endIndex = Math.min(books.length, startIndex + visibleCount)
  const visibleBooks = books.slice(startIndex, endIndex)

  return (
    <div className="space-y-2 overflow-x-auto lg:overflow-x-visible pb-4">
      <div className="min-w-[800px] lg:min-w-0">
        <div className="flex items-center gap-5 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
          <div className="w-14 shrink-0" />
          <div className="flex-1 min-w-0" style={gridStyle}>
            <div />
            <div>Title / Author</div>
            <div>Narrator</div>
            <div>Series</div>
            <div className="text-center">Purchased</div>
            <div className="text-center">Released</div>
            <div />
          </div>
        </div>

        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {visibleBooks.map((book, index) => (
            <LibraryListRow
              key={book.id}
              book={book}
              gridStyle={gridStyle}
              details={detailsCache[book.id]}
              onSelect={setSelectedBook}
              style={{
                position: 'absolute',
                top: `${(startIndex + index) * VIRTUAL_ROW_SIZE}px`,
                left: 0,
                right: 0,
                height: `${ROW_HEIGHT}px`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const formatSpeed = (bytesPerSec?: number) => {
  if (!bytesPerSec || bytesPerSec <= 0) return ''
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

const LibraryListRow = memo(function LibraryListRow({
  book,
  gridStyle,
  details,
  onSelect,
  style
}: {
  book: Book
  gridStyle: { display: 'grid'; gridTemplateColumns: string; gap: string; alignItems: 'center' }
  details: BookDetails | undefined
  onSelect: (book: Book) => void
  style: CSSProperties
}) {
  const handleDownload = useLibraryStore(s => s.handleDownload)
  const toggleSelection = useLibraryStore(s => s.toggleSelection)
  const { isDownloading, isQueued, progress, speed, phase, isSelected } = useLibraryStore(useShallow(s => ({
    isDownloading: s.downloadingIds.has(book.id),
    isQueued: s.queue.some(q => q.bookId === book.id && q.status === 'queued'),
    progress: s.downloadProgress[book.id] || 0,
    speed: s.downloadSpeed[book.id],
    phase: s.downloadPhase[book.id],
    isSelected: s.selectedIds.has(book.id)
  })))

  const handleRowClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation()
      toggleSelection(book.id)
    } else {
      onSelect(book)
    }
  }

  const effectiveDuration = book.duration || (details?.duration ?? '')
  const displayDuration = effectiveDuration ? formatDurationDisplay(effectiveDuration) : ''
  const releaseDate = details?.releaseDate ? parseAudibleDate(details.releaseDate) : null
  const purchaseDate = book.purchaseDate
  const seriesBadge = book.series && (book.seriesSequence || details?.seriesSequence)
    ? `#${book.seriesSequence || details?.seriesSequence}`
    : null

  return (
    <div
      onClick={handleRowClick}
      style={style}
      className={`group flex items-center gap-5 p-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
        isSelected ? 'bg-amber-500/10 border-amber-500/40' : 'bg-[#0f172a]/20 hover:bg-[#0f172a]/40 border-slate-800/40 hover:border-amber-500/20'
      }`}
    >
      <div className="w-14 h-14 shrink-0 relative rounded-xl overflow-hidden">
        {book.coverUrl ? (
          <img src={book.coverUrl} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <BookOpen size={18} className="text-slate-800" />
          </div>
        )}
        {book.isDownloaded && (
          <div className="absolute -top-0.5 -right-0.5 bg-emerald-500 p-0.5 rounded-full border-2 border-[#020617]">
            <HardDrive size={8} className="text-white" />
          </div>
        )}
        {book.isInAbs && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-sky-500 p-0.5 rounded-full border-2 border-[#020617]">
            <CheckCircle2 size={8} className="text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0" style={gridStyle}>
        <div className="flex items-center justify-center">
          <div 
            onClick={(e) => { e.stopPropagation(); toggleSelection(book.id) }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'border-white/20 text-transparent group-hover:border-white/40'
            }`}
          >
            <CheckCircle2 size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-[13px] text-white truncate group-hover:text-amber-400 transition-colors">{book.title}</h3>
          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{normalizeContributorName(book.author)}</p>
        </div>
        <div className="min-w-0">
          {book.narrator
            ? <span className="text-[11px] text-slate-400 font-medium truncate block">{normalizeContributorName(book.narrator)}</span>
            : <span className="text-[11px] text-slate-800">--</span>}
        </div>
        <div className="min-w-0">
          {book.series ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate block">{book.series}</span>
              {seriesBadge && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest text-amber-400">
                  {seriesBadge}
                </span>
              )}
            </div>
          ) : <span className="text-[10px] text-slate-800">--</span>}
        </div>
        <div className="text-center">
          {purchaseDate
            ? <span className="text-[10px] font-bold text-slate-600">{new Date(purchaseDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
            : <span className="text-[10px] text-slate-800">--</span>}
        </div>
        <div className="text-center">
          {releaseDate
            ? <span className="text-[10px] font-bold text-slate-800/60">{new Date(releaseDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
            : <span className="text-[10px] text-slate-800">--</span>}
        </div>
        <div className="flex justify-end">
          {isDownloading ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest shrink-0">{phase === 'convert' ? 'Converting' : 'Downloading'}</span>
                  {phase !== 'convert' && speed && speed > 0 && (
                    <span className="text-[9px] font-black text-amber-500/60 tabular-nums">{formatSpeed(speed)}</span>
                  )}
                  <span className="text-[9px] font-black text-slate-400">{progress}%</span>
                </div>
                <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <RefreshCw size={16} className="text-amber-500 animate-spin shrink-0" />
            </div>
          ) : isQueued ? (
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500/60" />
              <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">Queued</span>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); handleDownload(book) }}
              className={`p-2 rounded-xl transition-all ${book.isDownloaded ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-amber-500 hover:bg-amber-500/10'}`}
            >
              {book.isDownloaded ? <RefreshCw size={16} /> : <Download size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
