import { useLibraryStore } from '../stores/useLibraryStore'

export function NasScanProgress() {
  const scanProgress = useLibraryStore(s => s.scanProgress)
  if (!scanProgress) return null

  const pct = Math.round((scanProgress.current / scanProgress.total) * 100)
  return (
    <div className="mb-10 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex justify-between items-end mb-4">
        <div className="space-y-1">
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500">Scanning Network Folder</h4>
          <p className="text-sm font-bold text-white truncate max-w-md">{scanProgress.filename}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white">{pct}%</span>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {scanProgress.current} of {scanProgress.total} files
          </p>
        </div>
      </div>
      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
        />
      </div>
    </div>
  )
}
