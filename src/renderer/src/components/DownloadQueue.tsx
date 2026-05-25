import {
  AlertCircle, CheckCircle2, Clock, Download, Loader2, Pause, Play, RotateCcw, Trash2, X, XCircle
} from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { QueueItem } from '../types'
import { normalizeContributorName } from '../../../shared/index'

export function DownloadQueue() {
  const queue = useLibraryStore(s => s.queue)
  const books = useLibraryStore(s => s.books)
  const queuePaused = useLibraryStore(s => s.queuePaused)
  const downloadProgress = useLibraryStore(s => s.downloadProgress)
  const downloadSpeed = useLibraryStore(s => s.downloadSpeed)
  const downloadPhase = useLibraryStore(s => s.downloadPhase)
  const toggleQueuePanel = useLibraryStore(s => s.toggleQueuePanel)
  const pauseQueue = useLibraryStore(s => s.pauseQueue)
  const resumeQueue = useLibraryStore(s => s.resumeQueue)
  const cancelDownload = useLibraryStore(s => s.cancelDownload)
  const clearCompletedFromQueue = useLibraryStore(s => s.clearCompletedFromQueue)
  const addManyToQueue = useLibraryStore(s => s.addManyToQueue)
  const retryDownload = useLibraryStore(s => s.retryDownload)

  const queuedCount = queue.filter(q => q.status === 'queued').length
  const activeCount = queue.filter(q => q.status === 'downloading' || q.status === 'converting').length
  const completedCount = queue.filter(q => q.status === 'completed').length
  const failedCount = queue.filter(q => q.status === 'failed').length
  const finishedCount = queue.filter(q => q.status === 'completed' || q.status === 'failed').length

  const handleDownloadAllMissing = () => {
    const missingIds = books
      .filter(b => !b.isDownloaded && !b.isIgnored)
      .map(b => b.id)
    if (missingIds.length === 0) return
    addManyToQueue(missingIds)
  }

  const missingCount = books.filter(b => !b.isDownloaded && !b.isIgnored).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500" onClick={toggleQueuePanel} />
      <div className="relative w-full md:max-w-sm bg-[#0f172a] shadow-3xl h-full flex flex-col animate-in slide-in-from-right duration-500 border-l border-slate-800/60">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2.5">
              <Download size={18} className="text-amber-500" />
              Downloads
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={queuePaused ? resumeQueue : pauseQueue}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"
                title={queuePaused ? 'Resume queue' : 'Pause queue'}
              >
                {queuePaused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button
                onClick={toggleQueuePanel}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {queuedCount > 0 && <span>{queuedCount} queued</span>}
            {activeCount > 0 && <span className="text-amber-500">{activeCount} active</span>}
            {completedCount > 0 && <span className="text-emerald-500">{completedCount} done</span>}
            {failedCount > 0 && <span className="text-rose-500">{failedCount} failed</span>}
            {queue.length === 0 && <span>No downloads</span>}
            {queuePaused && <span className="text-amber-400 ml-auto">PAUSED</span>}
          </div>
        </div>

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {queue.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
              <Download size={40} className="mb-4" />
              <p className="text-sm font-bold">Queue is empty</p>
              <p className="text-xs mt-1">Add books to start downloading</p>
            </div>
          )}
          {queue.map(item => (
            <QueueItemRow
              key={item.bookId}
              item={item}
              book={books.find(b => b.id === item.bookId)}
              progress={downloadProgress[item.bookId] || 0}
              speed={downloadSpeed[item.bookId]}
              phase={downloadPhase[item.bookId]}
              onCancel={() => cancelDownload(item.bookId)}
              onRetry={() => retryDownload(item.bookId)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-slate-800/60 space-y-2">
          {finishedCount > 0 && (
            <button
              onClick={clearCompletedFromQueue}
              className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 transition-all border border-white/[0.02] flex items-center justify-center gap-2"
            >
              <Trash2 size={12} />
              Clear Finished ({finishedCount})
            </button>
          )}
          {missingCount > 0 && (
            <button
              onClick={handleDownloadAllMissing}
              className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20 flex items-center justify-center gap-2"
            >
              <Download size={12} />
              Download All Missing ({missingCount})
            </button>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}} />
    </div>
  )
}

function QueueItemRow({ item, book, progress, speed, phase, onCancel, onRetry }: {
  item: QueueItem
  book: { title: string; author: string; coverUrl: string | null } | undefined
  progress: number
  speed?: number
  phase: 'download' | 'convert' | undefined
  onCancel: () => void
  onRetry: () => void
}) {
  if (!book) return null

  const isActive = item.status === 'downloading' || item.status === 'converting'

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec || bytesPerSec === 0) return ''
    if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
      isActive
        ? 'bg-amber-500/5 border-amber-500/20'
        : item.status === 'completed'
          ? 'bg-emerald-500/5 border-emerald-500/10'
          : item.status === 'failed'
            ? 'bg-rose-500/5 border-rose-500/10'
            : 'bg-white/[0.02] border-white/[0.03]'
    }`}>
      {/* Cover */}
      <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-slate-900">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Download size={14} className="text-slate-700" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-white truncate leading-tight">{book.title}</p>
        <p className="text-[10px] text-slate-500 truncate">{normalizeContributorName(book.author)}</p>

        {isActive && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                  {phase === 'convert' ? 'Converting' : 'Downloading'}
                </span>
                <span className="text-[9px] font-black text-slate-500">{progress}%</span>
              </div>
              {phase !== 'convert' && speed && speed > 0 && (
                <span className="text-[9px] font-black text-amber-500/60 tabular-nums">
                  {formatSpeed(speed)}
                </span>
              )}
            </div>
            <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {item.status === 'failed' && item.error && (
          <p className="text-[9px] text-rose-400 mt-1 truncate">{item.error}</p>
        )}
      </div>

      {/* Status icon / action */}
      <div className="shrink-0 flex items-center gap-1">
        {item.status === 'queued' && (
          <>
            <Clock size={14} className="text-slate-500" />
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/5 text-slate-600 hover:text-rose-400 transition-all">
              <X size={12} />
            </button>
          </>
        )}
        {isActive && (
          <>
            <Loader2 size={14} className="text-amber-500 animate-spin" />
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/5 text-slate-600 hover:text-rose-400 transition-all">
              <X size={12} />
            </button>
          </>
        )}
        {item.status === 'completed' && (
          <CheckCircle2 size={14} className="text-emerald-500" />
        )}
        {item.status === 'failed' && (
          <>
            <AlertCircle size={14} className="text-rose-500" />
            <button onClick={onRetry} className="p-1 rounded-lg hover:bg-white/5 text-slate-600 hover:text-amber-400 transition-all">
              <RotateCcw size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
