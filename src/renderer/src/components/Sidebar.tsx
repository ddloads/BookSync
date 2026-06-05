import { useEffect, useState } from 'react'
import { Bell, BookOpen, ChevronLeft, ChevronRight, Cloud, Download, HardDrive, Library, RefreshCw, Settings } from 'lucide-react'
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
  const handleScanNas = useLibraryStore(s => s.handleScanNas)
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
    <aside className={`z-10 hidden h-screen shrink-0 flex-col border-r border-slate-800/40 bg-[#0f172a]/40 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 lg:flex ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}>
      <div className="flex flex-1 flex-col">
        <div className={`flex items-center gap-3 px-1 group cursor-default ${collapsed ? 'justify-center' : ''}`}>
          <div className="rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-2.5 shadow-xl shadow-amber-500/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-amber-500/20">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div className={`min-w-0 ${collapsed ? 'hidden' : ''}`}>
            <h1 className="truncate text-xl font-black leading-none tracking-tight text-white">BookSync</h1>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/70">Premium</span>
          </div>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="ml-auto flex items-center justify-center rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="mt-10 flex flex-1 flex-col space-y-1.5">
          <button
            onClick={() => setActiveTab('library')}
            title="My Library"
            className={`flex w-full items-center justify-start gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-300 ${
              activeTab === 'library'
                ? 'border border-amber-500/10 bg-amber-500/10 font-bold text-amber-400 shadow-sm shadow-amber-500/5'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Library size={18} className={activeTab === 'library' ? 'animate-pulse' : ''} />
            <span className={collapsed ? 'hidden' : ''}>My Library</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            title="Settings"
            className={`flex w-full items-center justify-start gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-300 ${
              activeTab === 'settings'
                ? 'border border-amber-500/10 bg-amber-500/10 font-bold text-amber-400 shadow-sm shadow-amber-500/5'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Settings size={18} />
            <span className={collapsed ? 'hidden' : ''}>Settings</span>
          </button>
        </nav>

        <div className="mt-auto space-y-3 border-t border-slate-800/60 pt-6">
          <button
            onClick={toggleShowNotifications}
            title="Activity"
            className="group relative flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.02] bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-slate-400 transition-all duration-300 hover:bg-white/[0.08] hover:text-slate-200"
          >
            <Bell size={16} className="transition-transform group-hover:rotate-12" />
            <span className={collapsed ? 'hidden' : ''}>Activity</span>
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white shadow-lg shadow-amber-500/40">
                {notifications.length}
              </span>
            )}
          </button>

          <button
            onClick={toggleQueuePanel}
            title="Downloads"
            className="group relative flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.02] bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-slate-400 transition-all duration-300 hover:bg-white/[0.08] hover:text-slate-200"
          >
            <Download size={16} className="transition-transform group-hover:translate-y-0.5" />
            <span className={collapsed ? 'hidden' : ''}>Downloads</span>
            {activeQueueCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white shadow-lg shadow-amber-500/40 animate-pulse">
                {activeQueueCount}
              </span>
            )}
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Sync Cloud"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 px-4 py-3 text-[13px] font-black text-[#020617] shadow-xl shadow-amber-500/10 transition-all duration-500 hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            <span className={collapsed ? 'hidden' : ''}>SYNC CLOUD</span>
          </button>

          <button
            onClick={handleScanAzure}
            disabled={isScanning}
            title="Sync Azure"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-sky-500/10 bg-sky-500/10 px-4 py-3 text-[13px] font-black text-sky-400 transition-all duration-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <Cloud size={16} className={isScanning ? 'animate-pulse' : ''} />
            <span className={collapsed ? 'hidden' : ''}>SYNC AZURE</span>
          </button>

          <button
            onClick={handleScanNas}
            disabled={isScanning}
            title="Sync NAS"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-emerald-500/10 bg-emerald-500/10 px-4 py-3 text-[13px] font-black text-emerald-400 transition-all duration-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <HardDrive size={16} className={isScanning ? 'animate-pulse' : ''} />
            <span className={collapsed ? 'hidden' : ''}>SYNC NAS</span>
          </button>
        </div>

        {enrichProgress && (
          <div className="mt-2 space-y-1.5 px-1">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <RefreshCw size={9} className="animate-spin text-amber-500/60" />
                <span className={collapsed ? 'hidden' : ''}>Fetching metadata</span>
              </span>
              <span className={`text-[9px] font-black text-slate-500 ${collapsed ? 'hidden' : ''}`}>
                {enrichProgress.completed} / {enrichProgress.total}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-500/40 transition-all duration-300"
                style={{ width: `${Math.round((enrichProgress.completed / enrichProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {version && !collapsed && (
          <div className="px-1 pt-2 text-left">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              v{version}
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
