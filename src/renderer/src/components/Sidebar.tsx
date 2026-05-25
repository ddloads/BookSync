import { useEffect, useState } from 'react'
import { Bell, BookOpen, ChevronLeft, ChevronRight, Cloud, Download, Library, RefreshCw, Settings } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useNotificationStore } from '../stores/useNotificationStore'

export function Sidebar() {
  const [version, setVersion] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const activeTab = useLibraryStore(s => s.activeTab)
  const setActiveTab = useLibraryStore(s => s.setActiveTab)
  const isSyncing = useLibraryStore(s => s.isSyncing)
  const isScanning = useLibraryStore(s => s.isScanning)
  const handleSync = useLibraryStore(s => s.handleSync)
  const handleScanAzure = useLibraryStore(s => s.handleScanAzure)
  const enrichProgress = useLibraryStore(s => s.enrichProgress)
  const queue = useLibraryStore(s => s.queue)
  const toggleQueuePanel = useLibraryStore(s => s.toggleQueuePanel)
  const notifications = useNotificationStore(s => s.notifications)
  const toggleShowNotifications = useNotificationStore(s => s.toggleShowNotifications)

  const activeQueueCount = queue.filter(q => q.status === 'queued' || q.status === 'downloading' || q.status === 'converting').length

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => {
      setVersion('')
    })
    window.api.settings.get('sidebarCollapsed', 'false').then(value => {
      setCollapsed(value === 'true')
    }).catch(() => {
      setCollapsed(false)
    })
  }, [])

  const toggleCollapsed = async () => {
    const next = !collapsed
    setCollapsed(next)
    window.api.settings.set('sidebarCollapsed', String(next)).catch(() => {
      setCollapsed(!next)
    })
  }

  return (
    <aside className={`w-20 ${collapsed ? 'lg:w-20' : 'lg:w-64'} shrink-0 border-r border-slate-800/40 bg-[#0f172a]/40 backdrop-blur-xl p-4 lg:p-6 flex flex-col z-10 shadow-2xl transition-all duration-300`}>
      <div className={`flex items-center gap-3 mb-10 px-1 group cursor-default ${collapsed ? 'justify-center' : ''}`}>
        <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-2 lg:p-2.5 rounded-xl lg:rounded-2xl shadow-xl shadow-amber-500/10 group-hover:shadow-amber-500/20 transition-all duration-500 group-hover:scale-110">
          <BookOpen className="text-white w-5 h-5 lg:w-6 lg:h-6" />
        </div>
        <div className={collapsed ? 'hidden' : 'hidden lg:block'}>
          <h1 className="text-xl font-black tracking-tight text-white leading-none mb-1">BookSync</h1>
          <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-[0.2em]">Premium</span>
        </div>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto hidden lg:flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="space-y-1.5 flex-1">
        <button
          onClick={() => setActiveTab('library')}
          title="My Library"
          className={`w-full flex items-center justify-center lg:justify-start gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
            activeTab === 'library'
              ? 'bg-amber-500/10 text-amber-400 font-bold shadow-sm shadow-amber-500/5 border border-amber-500/10'
              : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Library size={18} className={activeTab === 'library' ? 'animate-pulse' : ''} />
          <span className={collapsed ? 'hidden' : 'hidden lg:block'}>My Library</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          title="Settings"
          className={`w-full flex items-center justify-center lg:justify-start gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
            activeTab === 'settings'
              ? 'bg-amber-500/10 text-amber-400 font-bold shadow-sm shadow-amber-500/5 border border-amber-500/10'
              : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings size={18} />
          <span className={collapsed ? 'hidden' : 'hidden lg:block'}>Settings</span>
        </button>
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-800/60 space-y-3">
        <button
          onClick={toggleShowNotifications}
          title="Activity"
          className="w-full bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 text-[13px] font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 border border-white/[0.02] relative group"
        >
          <Bell size={16} className="group-hover:rotate-12 transition-transform" />
          <span className={collapsed ? 'hidden' : 'hidden lg:block'}>Activity</span>
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-[9px] text-white w-4.5 h-4.5 rounded-full flex items-center justify-center font-black shadow-lg shadow-amber-500/40">
              {notifications.length}
            </span>
          )}
        </button>

        <button
          onClick={toggleQueuePanel}
          title="Downloads"
          className="w-full bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 text-[13px] font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 border border-white/[0.02] relative group"
        >
          <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
          <span className={collapsed ? 'hidden' : 'hidden lg:block'}>Downloads</span>
          {activeQueueCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-[9px] text-white w-4.5 h-4.5 rounded-full flex items-center justify-center font-black shadow-lg shadow-amber-500/40 animate-pulse">
              {activeQueueCount}
            </span>
          )}
        </button>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync Cloud"
          className="w-full bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#020617] text-[13px] font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-500 shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95"
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          <span className={collapsed ? 'hidden' : 'hidden lg:block'}>SYNC CLOUD</span>
        </button>

        <button
          onClick={handleScanAzure}
          disabled={isScanning}
          title="Sync Azure"
          className="w-full bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sky-400 text-[13px] font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 border border-sky-500/10 active:scale-95"
        >
          <Cloud size={16} className={isScanning ? 'animate-pulse' : ''} />
          <span className={collapsed ? 'hidden' : 'hidden lg:block'}>SYNC AZURE</span>
        </button>

        {enrichProgress && (
          <div className="mt-2 px-1 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <RefreshCw size={9} className="animate-spin text-amber-500/60" />
                <span className={collapsed ? 'hidden' : 'hidden lg:block'}>Fetching metadata</span>
              </span>
              <span className={`text-[9px] font-black text-slate-500 ${collapsed ? 'hidden' : 'hidden lg:block'}`}>
                {enrichProgress.completed} / {enrichProgress.total}
              </span>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500/40 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((enrichProgress.completed / enrichProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {version && !collapsed && (
          <div className="px-1 pt-2 text-center lg:text-left">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
              v{version}
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
