import { useEffect, useRef, useState } from 'react'
import { Bell, BookOpen, Cloud, HardDrive, Menu, RefreshCw } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useNotificationStore } from '../stores/useNotificationStore'

interface MobileTopBarProps {
  onOpenDrawer: () => void
}

export function MobileTopBar({ onOpenDrawer }: MobileTopBarProps) {
  const isSyncing = useLibraryStore(s => s.isSyncing)
  const isScanning = useLibraryStore(s => s.isScanning)
  const handleSync = useLibraryStore(s => s.handleSync)
  const handleScanNas = useLibraryStore(s => s.handleScanNas)
  const handleScanAzure = useLibraryStore(s => s.handleScanAzure)
  const notifications = useNotificationStore(s => s.notifications)
  const toggleShowNotifications = useNotificationStore(s => s.toggleShowNotifications)

  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const syncMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!syncMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (syncMenuRef.current && !syncMenuRef.current.contains(e.target as Node)) {
        setSyncMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [syncMenuOpen])

  const syncBusy = isSyncing || isScanning

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-800/50 bg-[#020617]/85 px-3 pt-safe backdrop-blur-xl lg:hidden">
      <button
        onClick={onOpenDrawer}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors active:bg-white/5"
      >
        <Menu size={22} />
      </button>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <div className="rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-1.5 shadow-lg shadow-amber-500/10">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <h1 className="truncate text-base font-black tracking-tight text-white">BookSync</h1>
      </div>

      <div className="relative" ref={syncMenuRef}>
        <button
          onClick={() => setSyncMenuOpen(o => !o)}
          aria-label="Sync menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-amber-400 transition-colors active:bg-amber-500/10"
        >
          <RefreshCw size={20} className={syncBusy ? 'animate-spin' : ''} />
        </button>
        {syncMenuOpen && (
          <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] py-2 shadow-2xl backdrop-blur-xl">
            <SyncMenuItem
              icon={<RefreshCw size={16} />}
              label="Sync Cloud"
              busy={isSyncing}
              tint="amber"
              onClick={() => { setSyncMenuOpen(false); handleSync() }}
            />
            <SyncMenuItem
              icon={<Cloud size={16} />}
              label="Sync Azure"
              busy={isScanning}
              tint="sky"
              onClick={() => { setSyncMenuOpen(false); handleScanAzure() }}
            />
            <SyncMenuItem
              icon={<HardDrive size={16} />}
              label="Sync NAS"
              busy={isScanning}
              tint="emerald"
              onClick={() => { setSyncMenuOpen(false); handleScanNas() }}
            />
          </div>
        )}
      </div>

      <button
        onClick={toggleShowNotifications}
        aria-label="Activity"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors active:bg-white/5"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </button>
    </header>
  )
}

function SyncMenuItem({
  icon, label, busy, tint, onClick
}: {
  icon: React.ReactNode
  label: string
  busy: boolean
  tint: 'amber' | 'sky' | 'emerald'
  onClick: () => void
}) {
  const tintClass = tint === 'amber'
    ? 'text-amber-400'
    : tint === 'sky'
      ? 'text-sky-400'
      : 'text-emerald-400'
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 transition-colors active:bg-white/5 disabled:opacity-50"
    >
      <span className={tintClass}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
