import { useEffect, useState } from 'react'
import { Bell, BookOpen, Cloud, Download, HardDrive, Library, RefreshCw, Settings, X } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useShallow } from 'zustand/react/shallow'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const [version, setVersion] = useState('')
  const {
    activeTab, setActiveTab,
    isSyncing, isScanning,
    handleSync, handleScanNas, handleScanAzure,
    showQueuePanel, toggleQueuePanel,
    queue, enrichProgress
  } = useLibraryStore(
    useShallow(s => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      isSyncing: s.isSyncing,
      isScanning: s.isScanning,
      handleSync: s.handleSync,
      handleScanNas: s.handleScanNas,
      handleScanAzure: s.handleScanAzure,
      showQueuePanel: s.showQueuePanel,
      toggleQueuePanel: s.toggleQueuePanel,
      queue: s.queue,
      enrichProgress: s.enrichProgress,
    }))
  )
  const notifications = useNotificationStore(s => s.notifications)
  const toggleShowNotifications = useNotificationStore(s => s.toggleShowNotifications)

  const activeQueueCount = queue.filter(
    q => q.status === 'queued' || q.status === 'downloading' || q.status === 'converting'
  ).length

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => setVersion(''))
  }, [])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  const goTab = (tab: string) => {
    if (showQueuePanel) toggleQueuePanel()
    setActiveTab(tab)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-sheet-fade"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-[min(20rem,85vw)] min-h-0 flex-col border-r border-slate-800/60 bg-[#0f172a] shadow-2xl pt-safe pb-safe animate-drawer-in">
        <div className="flex items-center gap-3 border-b border-slate-800/50 px-5 py-4">
          <div className="rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-2 shadow-lg shadow-amber-500/10">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-base font-black tracking-tight text-white leading-none">BookSync</h1>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/70">Premium</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors active:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
          <DrawerItem
            icon={<Library size={18} />}
            label="My Library"
            active={activeTab === 'library' && !showQueuePanel}
            onClick={() => goTab('library')}
          />
          <DrawerItem
            icon={<Settings size={18} />}
            label="Settings"
            active={activeTab === 'settings' && !showQueuePanel}
            onClick={() => goTab('settings')}
          />
          <DrawerItem
            icon={<Bell size={18} />}
            label="Activity"
            badge={notifications.length > 0 ? notifications.length : undefined}
            onClick={() => { toggleShowNotifications(); onClose() }}
          />
          <DrawerItem
            icon={<Download size={18} />}
            label="Downloads"
            active={showQueuePanel}
            badge={activeQueueCount > 0 ? activeQueueCount : undefined}
            onClick={() => { toggleQueuePanel(); onClose() }}
          />

          <div className="my-4 h-px bg-slate-800/60" />

          <button
            onClick={() => { handleSync(); onClose() }}
            disabled={isSyncing}
            className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 px-4 py-3 text-[12px] font-black uppercase tracking-widest text-[#020617] shadow-lg shadow-amber-500/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            Sync Cloud
          </button>
          <button
            onClick={() => { handleScanAzure(); onClose() }}
            disabled={isScanning}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-sky-500/15 bg-sky-500/10 px-4 py-3 text-[12px] font-black uppercase tracking-widest text-sky-400 transition-all active:scale-95 disabled:opacity-50"
          >
            <Cloud size={16} className={isScanning ? 'animate-pulse' : ''} />
            Sync Azure
          </button>
          <button
            onClick={() => { handleScanNas(); onClose() }}
            disabled={isScanning}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3 text-[12px] font-black uppercase tracking-widest text-emerald-400 transition-all active:scale-95 disabled:opacity-50"
          >
            <HardDrive size={16} className={isScanning ? 'animate-pulse' : ''} />
            Sync NAS
          </button>

          {enrichProgress && (
            <div className="mt-4 px-1 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <RefreshCw size={9} className="animate-spin text-amber-500/60" />
                  Fetching metadata
                </span>
                <span className="text-[9px] font-black text-slate-500">
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
        </nav>

        {version && (
          <div className="border-t border-slate-800/50 px-5 py-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              v{version}
            </span>
          </div>
        )}
      </aside>
    </div>
  )
}

function DrawerItem({
  icon, label, active, badge, onClick
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
        active
          ? 'border border-amber-500/15 bg-amber-500/10 font-bold text-amber-400'
          : 'text-slate-300 active:bg-white/5'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
