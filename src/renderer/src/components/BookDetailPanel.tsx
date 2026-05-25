import { useMemo } from 'react'
import {
  BookOpen, CheckCircle2, Clock, Copy, Download, ExternalLink, Eye, EyeOff, HardDrive, PlayCircle, RefreshCw, X
} from 'lucide-react'
import { toast } from 'sonner'
import { Book } from '../types'
import { formatDurationDisplay, parseAudibleDate, parseDurationToMinutes, sanitizePath } from '../utils'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useFilterStore } from '../stores/useFilterStore'
import { notifySuccess } from '../stores/useNotificationStore'
import { normalizeContributorName } from '../../../shared/index'

function stripHtmlSummary(value: string): string {
  return value
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

function splitContributors(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(/\s*,\s*/).map(part => normalizeContributorName(part)).filter(Boolean)
}

function normalizedContributorKey(value: string | null | undefined): string {
  return splitContributors(value)
    .map(part => part.toLowerCase())
    .sort()
    .join(' | ')
}

export function BookDetailPanel() {
  const book = useLibraryStore(s => s.selectedBook)!
  const isWebRuntime = !navigator.userAgent.toLowerCase().includes('electron')
  const books = useLibraryStore(s => s.books)
  const detailsCache = useLibraryStore(s => s.detailsCache)
  const detailsLoading = useLibraryStore(s => s.detailsLoading)
  const nasPath = useLibraryStore(s => s.nasPath)
  const downloadingIds = useLibraryStore(s => s.downloadingIds)
  const downloadProgress = useLibraryStore(s => s.downloadProgress)
  const downloadPhase = useLibraryStore(s => s.downloadPhase)
  const setSelectedBook = useLibraryStore(s => s.setSelectedBook)
  const handleDownload = useLibraryStore(s => s.handleDownload)
  const handleToggleIgnore = useLibraryStore(s => s.handleToggleIgnore)
  const handleRescan = useLibraryStore(s => s.handleRescan)
  const clearAllFilters = useFilterStore(s => s.clearAllFilters)
  const toggleAuthor = useFilterStore(s => s.toggleAuthor)
  const toggleNarrator = useFilterStore(s => s.toggleNarrator)
  const toggleSeries = useFilterStore(s => s.toggleSeries)
  const togglePublisher = useFilterStore(s => s.togglePublisher)
  const toggleCategory = useFilterStore(s => s.toggleCategory)
  const setShowFilterPanel = useFilterStore(s => s.setShowFilterPanel)

  const details = detailsCache[book.id]
  const isDownloading = downloadingIds.has(book.id)
  const progress = downloadProgress[book.id] || 0
  const phase = downloadPhase[book.id] || 'download'

  const effectiveDuration = book.duration || (details?.duration ?? '')
  const description = details?.description ? stripHtmlSummary(details.description) : ''
  const authors = splitContributors(book.author)
  const narrators = splitContributors(book.narrator)
  const releaseDate = details?.releaseDate ? parseAudibleDate(details.releaseDate) : null
  const purchaseDate = book.purchaseDate
  const durationMinutes = parseDurationToMinutes(effectiveDuration)
  const durationHours = durationMinutes ? (durationMinutes / 60).toFixed(1) : null
  const displayDuration = effectiveDuration ? formatDurationDisplay(effectiveDuration) : ''
  const effectiveSeriesSequence = book.seriesSequence || details?.seriesSequence || ''
  const seriesOrderLabel = book.series && effectiveSeriesSequence
    ? `${book.series} - Book ${effectiveSeriesSequence}`
    : book.series || null

  const derivedPath = nasPath
    ? `${nasPath}\\${sanitizePath(book.author)}\\${book.series ? sanitizePath(book.series) + '\\' : ''}${sanitizePath(book.title)}\\${sanitizePath(book.title)}.m4b`
    : null
  const nasFilePath = book.nasPath || derivedPath
  const isNonStandardPath = book.nasPath && derivedPath && book.nasPath !== derivedPath

  const relatedBooks = useMemo(() => ({
    sameAuthor: books.filter(b => normalizedContributorKey(b.author) === normalizedContributorKey(book.author) && b.id !== book.id),
    sameSeries: book.series ? books.filter(b => b.series === book.series && b.id !== book.id) : [],
    sameNarrator: book.narrator ? books.filter(b => normalizedContributorKey(b.narrator) === normalizedContributorKey(book.narrator) && b.id !== book.id) : [],
  }), [book, books])

  function applyLibraryFilter(action: () => void) {
    clearAllFilters()
    action()
    setShowFilterPanel(false)
    setSelectedBook(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500" onClick={() => setSelectedBook(null)} />
      <div className="relative w-full md:max-w-2xl bg-[#0f172a] shadow-3xl h-full flex flex-col animate-in slide-in-from-right duration-500 border-l border-slate-800/60">
        <button
          onClick={() => setSelectedBook(null)}
          className="absolute top-4 left-4 lg:top-8 lg:left-8 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all duration-300 border border-white/[0.03] z-10"
        >
          <X size={20} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="relative aspect-square md:aspect-[4/3] w-full overflow-hidden">
            {book.coverUrl ? (
              <img src={book.coverUrl} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <BookOpen size={80} className="text-slate-800" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent" />
          </div>

          <div className="px-6 md:px-10 -mt-16 md:-mt-20 relative space-y-8 pb-10">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {book.isDownloaded ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                    <HardDrive size={10} /> On NAS Storage
                  </span>
                ) : (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/10 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                    <Download size={10} /> Available for Sync
                  </span>
                )}
                {book.isInAbs && (
                  <span className="bg-sky-500/10 text-sky-400 border border-sky-500/10 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 size={10} /> Confirmed in ABS
                  </span>
                )}
                {effectiveDuration && (
                  <span className="bg-white/5 text-slate-400 border border-white/5 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={10} /> {displayDuration}
                  </span>
                )}
                {seriesOrderLabel && (
                  <span className="bg-violet-500/10 text-violet-400 border border-violet-500/10 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen size={10} /> {seriesOrderLabel}
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-black text-white leading-tight tracking-tight">{book.title}</h2>
              <div className="flex flex-wrap gap-2">
                {authors.map(author => (
                  <FilterActionButton key={author} label={author} onClick={() => applyLibraryFilter(() => toggleAuthor(author))} accent="amber" />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Publisher Summary</h4>
              {detailsLoading && !details ? (
                <div className="flex items-center gap-3 py-6">
                  <RefreshCw size={14} className="animate-spin text-amber-500/50" />
                  <span className="text-[12px] text-slate-600 font-medium">Fetching details from Audible...</span>
                </div>
              ) : description ? (
                <p className="text-[13px] text-slate-400 leading-relaxed font-medium whitespace-pre-line">{description}</p>
              ) : (
                <p className="text-[12px] text-slate-600 italic">{details ? 'No description available for this title.' : 'Loading...'}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailCard label="Narrated By">
                {narrators.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {narrators.map(narrator => (
                      <FilterActionButton key={narrator} label={narrator} onClick={() => applyLibraryFilter(() => toggleNarrator(narrator))} />
                    ))}
                  </div>
                ) : (
                  'Unknown'
                )}
              </DetailCard>
              <DetailCard label="Series">
                {book.series ? (
                  <FilterActionButton label={seriesOrderLabel || book.series} onClick={() => applyLibraryFilter(() => toggleSeries(book.series!))} accent="violet" />
                ) : (
                  'Standalone'
                )}
              </DetailCard>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Duration</span>
                <span className="text-[13px] font-bold text-slate-300">{displayDuration || (detailsLoading ? 'Loading...' : 'Unknown')}</span>
                {durationHours && <span className="text-[10px] text-slate-600 font-bold block mt-0.5">{durationHours} hours total</span>}
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Purchase Date</span>
                <span className="text-[13px] font-bold text-slate-300">
                  {purchaseDate
                    ? new Date(purchaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'Unknown'}
                </span>
                {purchaseDate && <RelativeDate date={purchaseDate} />}
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">ABS Status</span>
                <span className={`text-[13px] font-bold ${book.isInAbs ? 'text-sky-400' : 'text-slate-500'}`}>
                  {book.isInAbs ? 'Confirmed in library' : 'Not yet confirmed'}
                </span>
                {book.lastAbsConfirmedAt && <RelativeDate date={book.lastAbsConfirmedAt} />}
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Release Date</span>
                <span className="text-[13px] font-bold text-slate-300">
                  {releaseDate
                    ? new Date(releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : (detailsLoading ? 'Loading...' : 'Unknown')}
                </span>
                {releaseDate && <RelativeDate date={releaseDate} />}
              </div>
              {details?.publisher && (
                <DetailCard label="Publisher">
                  <FilterActionButton label={details.publisher} onClick={() => applyLibraryFilter(() => togglePublisher(details.publisher))} />
                </DetailCard>
              )}
              {details?.language && <DetailCard label="Language" value={details.language} />}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">ASIN</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <code className="text-[13px] font-mono text-slate-300 font-bold">{book.id}</code>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(book.id); notifySuccess('ASIN copied', { duration: 1500 }) }} className="p-1 hover:bg-white/5 rounded text-slate-600 hover:text-slate-400 transition-colors">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              {details?.rating && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Rating</span>
                  <span className="text-[13px] font-bold text-amber-400">{details.rating.value.toFixed(1)} / 5</span>
                  <span className="text-[10px] text-slate-600 font-bold block mt-0.5">{details.rating.count.toLocaleString()} ratings</span>
                </div>
              )}
              {effectiveSeriesSequence && <DetailCard label="Series Position" value={`Book ${effectiveSeriesSequence}`} />}
              {details?.copyright && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors col-span-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Copyright</span>
                  <span className="text-[12px] font-medium text-slate-500">{details.copyright}</span>
                </div>
              )}
            </div>

            {details?.categories && details.categories.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {details.categories.map(cat => (
                    <FilterActionButton key={cat} label={cat} onClick={() => applyLibraryFilter(() => toggleCategory(cat))} />
                  ))}
                </div>
              </div>
            )}

            {book.isDownloaded && nasFilePath && (
              <div className={`p-4 rounded-2xl border ${isNonStandardPath ? 'bg-amber-500/[0.03] border-amber-500/20' : 'bg-emerald-500/[0.03] border-emerald-500/10'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest block ${isNonStandardPath ? 'text-amber-500/70' : 'text-emerald-500/70'}`}>
                    {isNonStandardPath ? 'Non-standard NAS Path' : 'Standard NAS Path'}
                  </span>
                  {isNonStandardPath && (
                    <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Renamed or Moved</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code className={`text-[11px] font-mono flex-1 break-all leading-relaxed ${isNonStandardPath ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>{nasFilePath}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(nasFilePath); notifySuccess('Path copied to clipboard', { duration: 1500 }) }}
                    className={`p-2 rounded-xl transition-all shrink-0 ${isNonStandardPath ? 'hover:bg-amber-500/10 text-amber-500/50 hover:text-amber-400' : 'hover:bg-emerald-500/10 text-emerald-500/50 hover:text-emerald-400'}`}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            {book.isDownloaded && isWebRuntime && (
              <div className="p-4 rounded-2xl border border-sky-500/10 bg-sky-500/[0.03] space-y-3">
                <div className="flex items-center gap-2">
                  <PlayCircle size={16} className="text-sky-400" />
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-sky-300">Audio Verification</h4>
                    <p className="text-[11px] font-bold text-slate-600">Plays the final exported file from the audiobook library.</p>
                  </div>
                </div>
                <audio
                  controls
                  preload="metadata"
                  src={`/api/books/${encodeURIComponent(book.id)}/audio`}
                  className="w-full"
                />
              </div>
            )}

            {isDownloading && (
              <div className="p-5 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{phase === 'convert' ? 'Converting' : 'Downloading'}</span>
                  <span className="text-lg font-black text-white">{progress}%</span>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleDownload(book)}
                disabled={isDownloading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black py-5 rounded-3xl text-sm font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-500/10 active:scale-[0.98]"
              >
                {isDownloading ? (
                  <><RefreshCw size={20} className="animate-spin" /> {phase === 'convert' ? 'Converting...' : 'Downloading...'}</>
                ) : book.isDownloaded ? (
                  <><RefreshCw size={20} /> Force Redownload</>
                ) : (
                  <><Download size={20} /> Download to NAS</>
                )}
              </button>
              
              <button
                onClick={() => handleRescan(book.id)}
                className="w-full bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all border border-white/[0.05]"
              >
                <RefreshCw size={14} /> Rescan Title on NAS
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => window.open(`https://www.audible.com/pd/${book.id}`, '_blank')}
                  className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all border border-white/[0.05]"
                >
                  <ExternalLink size={14} /> View on Audible
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${book.title} by ${authors.join(', ')}`); notifySuccess('Copied to clipboard', { duration: 1500 }) }}
                  className="bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 py-4 px-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all border border-white/[0.05]"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => handleToggleIgnore(book)}
                  className={`py-4 px-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all border ${
                    book.isIgnored
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/10'
                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/10'
                  }`}
                  title={book.isIgnored ? 'Restore to library' : 'Hide from library'}
                >
                  {book.isIgnored ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            </div>

            {relatedBooks.sameAuthor.length > 0 && (
              <RelatedRow title={`More by ${authors.join(', ')}`} count={relatedBooks.sameAuthor.length} books={relatedBooks.sameAuthor} accentClass="amber" onSelect={setSelectedBook} />
            )}
            {relatedBooks.sameSeries.length > 0 && (
              <RelatedRow title={`${book.series} Series`} count={relatedBooks.sameSeries.length + 1} countLabel="in library" books={relatedBooks.sameSeries} accentClass="violet" onSelect={setSelectedBook} />
            )}
            {relatedBooks.sameNarrator.length > 0 && (
              <RelatedRow title={`Also Narrated by ${book.narrator}`} count={relatedBooks.sameNarrator.length} books={relatedBooks.sameNarrator} accentClass="amber" onSelect={setSelectedBook} />
            )}

            <div className="pt-8 border-t border-slate-800/60 space-y-3">
              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Technical Details</h4>
              <div className="space-y-2">
                <TechRow label="Format">
                  <span className="text-[11px] text-slate-400 font-mono">{book.isDownloaded ? 'M4B (Converted)' : 'AAX (Encrypted)'}</span>
                </TechRow>
                <TechRow label="Download Link">
                  <span className="text-[11px] font-bold text-emerald-500/70">
                    Fetched on demand
                  </span>
                </TechRow>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailCard({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/10 transition-colors">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">{label}</span>
      {children ?? <span className="text-[13px] font-bold text-slate-300 leading-snug">{value}</span>}
    </div>
  )
}

function FilterActionButton({
  label,
  onClick,
  accent = 'slate'
}: {
  label: string
  onClick: () => void
  accent?: 'slate' | 'amber' | 'violet'
}) {
  const accentClass = accent === 'amber'
    ? 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10'
    : accent === 'violet'
      ? 'text-violet-400 border-violet-500/20 hover:bg-violet-500/10'
      : 'text-sky-300 border-sky-500/20 hover:bg-sky-500/10'

  return (
    <button
      onClick={onClick}
      className={`rounded-full border bg-white/[0.02] px-3 py-1.5 text-left text-[11px] font-bold transition-all ${accentClass}`}
    >
      {label}
    </button>
  )
}

function RelativeDate({ date }: { date: string }) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  let label: string
  if (days === 0) label = 'Today'
  else if (days === 1) label = 'Yesterday'
  else if (days < 30) label = `${days} days ago`
  else if (days < 365) label = `${Math.floor(days / 30)} months ago`
  else label = `${Math.floor(days / 365)} years ago`
  return <span className="text-[10px] text-slate-600 font-bold block mt-0.5">{label}</span>
}

function RelatedRow({
  title, count, countLabel = 'title', books, accentClass, onSelect
}: {
  title: string
  count: number
  countLabel?: string
  books: Book[]
  accentClass: 'amber' | 'violet'
  onSelect: (book: Book) => void
}) {
  const hoverColor = accentClass === 'violet' ? 'group-hover/related:text-violet-400' : 'group-hover/related:text-amber-400'
  const borderHover = accentClass === 'violet' ? 'group-hover/related:border-violet-500/30' : 'group-hover/related:border-amber-500/30'
  const titleColor = accentClass === 'violet' ? 'text-violet-400/70' : 'text-slate-500'

  return (
    <div className="pt-6 border-t border-slate-800/60 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleColor}`}>{title}</h4>
        <span className="text-[10px] font-bold text-slate-600">{count} {countLabel}{count !== 1 && countLabel === 'title' ? 's' : ''}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2" style={{ scrollbarWidth: 'thin' }}>
        {books.slice(0, 8).map(b => (
          <button key={b.id} onClick={() => onSelect(b)} className="shrink-0 w-20 group/related">
            <div className={`w-20 h-20 rounded-xl overflow-hidden mb-2 border border-slate-800/40 ${borderHover} transition-colors`}>
              {b.coverUrl
                ? <img src={b.coverUrl} className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full bg-slate-900 flex items-center justify-center"><BookOpen size={16} className="text-slate-800" /></div>
              }
            </div>
            <p className={`text-[9px] font-bold text-slate-500 ${hoverColor} transition-colors line-clamp-2 leading-tight text-left`}>{b.title}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function TechRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-600 font-medium">{label}</span>
      {children}
    </div>
  )
}
