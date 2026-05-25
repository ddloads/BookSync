import { useEffect, useState, useMemo } from 'react'
import { Activity, AlertCircle, CheckCircle2, Info, Search, Trash2, X } from 'lucide-react'
import { useLogStore } from '../stores/useLogStore'

export function LogsTab() {
  const logs = useLogStore(s => s.logs)
  const fetchLogs = useLogStore(s => s.fetchLogs)
  const clearLogs = useLogStore(s => s.clearLogs)
  const isLoading = useLogStore(s => s.isLoading)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'success' | 'error' | 'info'>('all')

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = filterType === 'all' || log.type === filterType
      
      return matchesSearch && matchesType
    })
  }, [logs, searchTerm, filterType])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Activity Logs</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} className="text-amber-500" />
            {logs.length} Total Events
          </p>
        </div>
        
        <button
          onClick={() => {
            if (confirm('Clear all persistent logs?')) {
              clearLogs()
            }
          }}
          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 group w-fit"
        >
          <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
          Clear Logs
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-amber-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-slate-800/80 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex bg-black/20 border border-slate-800/80 rounded-2xl p-1 w-fit">
          {(['all', 'success', 'error', 'info'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filterType === type 
                  ? 'bg-white/10 text-white' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 border border-slate-800/40 rounded-3xl">
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 animate-pulse">
            <Activity size={40} className="mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">Loading Logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-20">
            <Activity size={40} className="mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">No logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-5 flex gap-5 hover:bg-white/[0.02] transition-colors group">
                <div className={`mt-1 shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                  log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  log.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-500'
                }`}>
                  {log.type === 'success' ? <CheckCircle2 size={18} /> :
                   log.type === 'error' ? <AlertCircle size={18} /> :
                   <Info size={18} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <h4 className="text-sm font-black text-slate-200 truncate group-hover:text-white transition-colors">{log.title}</h4>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter shrink-0">{formatDate(log.timestamp)}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed line-clamp-2 group-hover:text-slate-400 transition-colors">
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
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
