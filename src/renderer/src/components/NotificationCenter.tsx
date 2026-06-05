import { Bell, Copy, Trash2 } from 'lucide-react'
import { useNotificationStore } from '../stores/useNotificationStore'
import { notifySuccess } from '../stores/useNotificationStore'

export function NotificationCenter() {
  const notifications = useNotificationStore(s => s.notifications)
  const clearNotifications = useNotificationStore(s => s.clearNotifications)

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col overflow-hidden rounded-t-3xl border-t border-slate-800/80 bg-[#0f172a] shadow-3xl backdrop-blur-2xl pb-safe animate-sheet-up lg:inset-x-auto lg:bottom-6 lg:left-72 lg:max-h-[550px] lg:w-[22rem] lg:rounded-3xl lg:border lg:pb-0 lg:animate-in lg:slide-in-from-left-8 lg:fade-in lg:duration-300">
      {/* Mobile drag handle */}
      <div className="flex shrink-0 justify-center pt-3 pb-1 lg:hidden">
        <div className="h-1.5 w-12 rounded-full bg-white/15" />
      </div>
      <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/40">
        <h3 className="font-black text-[13px] uppercase tracking-widest text-slate-400">Activity Log</h3>
        <button
          onClick={clearNotifications}
          className="text-slate-600 hover:text-rose-500 transition-colors duration-300 p-1.5 hover:bg-rose-500/10 rounded-lg"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30 grayscale">
            <Bell size={40} className="mb-4" />
            <p className="text-center text-xs font-bold tracking-widest uppercase">No Recent Activity</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className="p-4 rounded-2xl hover:bg-white/[0.03] transition-all duration-300 border border-transparent hover:border-white/[0.03] group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                  n.type === 'error'
                    ? 'bg-rose-500/10 text-rose-400'
                    : n.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {n.type}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${n.title}: ${n.description}`)
                      notifySuccess('Copied to clipboard', { duration: 1500, logToActivity: false })
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-500 hover:text-white"
                    title="Copy to clipboard"
                  >
                    <Copy size={12} />
                  </button>
                  <span className="text-[10px] text-slate-600 font-medium">
                    {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <h4 className="text-[13px] font-bold text-slate-200 mb-1">{n.title}</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{n.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
