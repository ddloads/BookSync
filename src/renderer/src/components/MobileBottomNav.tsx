import { Download, Library, Settings } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useShallow } from 'zustand/react/shallow'

export function MobileBottomNav() {
  const { activeTab, setActiveTab, showQueuePanel, toggleQueuePanel, queue, downloadingIds } = useLibraryStore(
    useShallow(s => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      showQueuePanel: s.showQueuePanel,
      toggleQueuePanel: s.toggleQueuePanel,
      queue: s.queue,
      downloadingIds: s.downloadingIds,
    }))
  )

  const activeQueueCount = queue.filter(
    q => q.status === 'queued' || q.status === 'downloading' || q.status === 'converting'
  ).length

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/60 bg-[#020617]/90 backdrop-blur-xl pb-safe lg:hidden">
      <div className="flex h-[4.5rem] items-stretch">
        <NavTab
          label="Library"
          icon={<Library size={20} />}
          active={activeTab === 'library' && !showQueuePanel}
          onClick={() => {
            if (showQueuePanel) toggleQueuePanel()
            setActiveTab('library')
          }}
        />
        <NavTab
          label="Queue"
          icon={<Download size={20} className={downloadingIds.size > 0 ? 'animate-pulse' : ''} />}
          active={showQueuePanel}
          badge={activeQueueCount > 0 ? activeQueueCount : undefined}
          onClick={toggleQueuePanel}
        />
        <NavTab
          label="Settings"
          icon={<Settings size={20} />}
          active={activeTab === 'settings' && !showQueuePanel}
          onClick={() => {
            if (showQueuePanel) toggleQueuePanel()
            setActiveTab('settings')
          }}
        />
      </div>
    </nav>
  )
}

function NavTab({
  label, icon, active, badge, onClick
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
        active ? 'text-amber-400' : 'text-slate-500 active:text-slate-300'
      }`}
    >
      {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-amber-500" />}
      <div className="relative">
        {icon}
        {badge !== undefined && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  )
}
