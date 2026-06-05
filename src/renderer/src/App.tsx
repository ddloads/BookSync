import { useEffect, useMemo, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { CheckCircle2, Download, Filter, HardDrive, Library, LogIn, LogOut, RefreshCw, Search, ArrowUp, SlidersHorizontal } from 'lucide-react'
import { useLibraryStore } from './stores/useLibraryStore'
import { useFilterStore } from './stores/useFilterStore'
import { useNotificationStore } from './stores/useNotificationStore'
import { LibraryGrid } from './components/LibraryGrid'
import { LibraryList } from './components/LibraryList'
import { Sidebar } from './components/Sidebar'
import { SelectionBar } from './components/SelectionBar'
import { BookDetailPanel } from './components/BookDetailPanel'
import { ControlsBar } from './components/ControlsBar'
import { FilterPanel } from './components/FilterPanel'
import { SettingsTab } from './components/SettingsTab'
import { LogsTab } from './components/LogsTab'
import { CompanionAppTab } from './components/CompanionAppTab'
import { NotificationCenter } from './components/NotificationCenter'
import { DownloadQueue } from './components/DownloadQueue'
import { useFilteredBooks } from './hooks/useFilteredBooks'

function App() {
  const {
    books,
    loadLibrary,
    loadSettings,
    activeTab,
    selectedBook,
    setSelectedBook,
    showQueuePanel,
    toggleQueuePanel
  } = useLibraryStore()

  const {
    showFilterPanel,
    setShowFilterPanel,
  } = useFilterStore()
  const { filteredBooks, activeFilterCount } = useFilteredBooks()

  const {
    notifications,
    showNotifications,
    hideNotifications,
    addNotification
  } = useNotificationStore()

  const mainScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    loadSettings()
    loadLibrary()
  }, [])

  useEffect(() => {
    return window.api.logs.onActivity(({ type, title, message }) => {
      addNotification(title, message, type)
    })
  }, [addNotification])

  useEffect(() => {
    const handleScroll = () => {
      if (mainScrollRef.current) {
        setShowScrollTop(mainScrollRef.current.scrollTop > 500)
      }
    }
    const scrollEl = mainScrollRef.current
    scrollEl?.addEventListener('scroll', handleScroll)
    return () => scrollEl?.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const unreadNotifications = notifications.length

  const filteredBookIds = useMemo(() => filteredBooks.map(b => b.id), [filteredBooks])

  const pagePercent = useMemo(() => {
    if (activeTab !== 'library' || filteredBooks.length === 0) return 0
    return 0 
  }, [activeTab, filteredBooks.length])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#020617] font-sans text-slate-200 selection:bg-amber-500/30 lg:flex-row">
      <Toaster 
        theme="dark" 
        position="bottom-right" 
        expand={true} 
        richColors 
        toastOptions={{
          style: {
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1.25rem'
          }
        }}
      />
      
      <Sidebar />

      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Top Floating Info */}
        <div className="absolute right-4 top-4 z-40 hidden items-center gap-4 sm:flex lg:right-8 lg:top-6">
          {unreadNotifications > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); useNotificationStore.getState().toggleShowNotifications() }}
              className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all group"
            >
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-black text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#020617] animate-pulse">
                {unreadNotifications}
              </div>
              <Filter size={18} className="text-slate-400 group-hover:text-white transition-colors" />
            </button>
          )}
        </div>

        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40" onClick={hideNotifications} />
            <NotificationCenter />
          </>
        )}

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto relative custom-scrollbar">
          {activeTab === 'library' && (
            <div className="p-4 pb-28 sm:pb-8 md:p-8 lg:p-10">
              {/* Header */}
              <header className="mb-8 flex flex-col justify-between gap-5 lg:mb-10 xl:flex-row xl:items-end">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-amber-500 rounded-full" />
                    <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                      Library
                      <span className="text-lg font-bold tabular-nums text-slate-700 sm:text-xl md:text-2xl">
                        {books.length}
                      </span>
                    </h1>
                  </div>
                  <p className="ml-5 max-w-2xl text-sm font-medium text-slate-500 md:text-base">Manage and sync your audiobook collection</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start xl:justify-end">
                  <button
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className={`relative flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-[11px] font-black uppercase tracking-widest transition-all sm:w-auto ${showFilterPanel ? 'bg-amber-500 text-black shadow-xl shadow-amber-500/20' : 'bg-[#0f172a]/60 border border-slate-800/50 text-slate-300 hover:bg-[#0f172a] hover:border-slate-700'}`}
                  >
                    <SlidersHorizontal size={16} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black ${showFilterPanel ? 'bg-black text-amber-500' : 'bg-amber-500 text-black'}`}>
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  
                  <button
                    onClick={toggleQueuePanel}
                    className={`flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-[11px] font-black uppercase tracking-widest transition-all sm:w-auto ${showQueuePanel ? 'bg-amber-500 text-black shadow-xl shadow-amber-500/20' : 'bg-[#0f172a]/60 border border-slate-800/50 text-slate-300 hover:bg-[#0f172a] hover:border-slate-700'}`}
                  >
                    <RefreshCw size={16} className={useLibraryStore.getState().downloadingIds.size > 0 ? 'animate-spin' : ''} />
                    Queue
                  </button>
                </div>
              </header>

              <div className="flex flex-col gap-8">
                <div className="flex-1 min-w-0">
                  <ControlsBar 
                    totalCount={books.length} 
                    currentCount={filteredBooks.length} 
                    filteredBookIds={filteredBookIds}
                  />

                  {filteredBooks.length > 0 ? (
                    useFilterStore.getState().viewMode === 'grid' ? (
                      <LibraryGrid books={filteredBooks} scrollContainerRef={mainScrollRef} />
                    ) : (
                      <LibraryList books={filteredBooks} scrollContainerRef={mainScrollRef} />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-800/50 bg-[#0f172a]/20 px-6 py-20 sm:rounded-[3rem] sm:py-32">
                      <div className="p-8 bg-slate-900/50 rounded-full mb-6">
                        <Search size={48} className="text-slate-700" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">No audiobooks found</h3>
                      <p className="text-slate-500 max-w-xs text-center leading-relaxed">
                        Try adjusting your filters or search terms to find what you're looking for.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'companion' && <CompanionAppTab />}
        </main>

        {/* Overlays */}
        {selectedBook && <BookDetailPanel />}
        {showQueuePanel && <DownloadQueue />}
        {showFilterPanel && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFilterPanel(false)}
            />
            <div className="absolute right-0 top-0 h-full w-full p-2 sm:w-[min(100vw-1rem,44rem)] sm:p-3 md:p-4">
              <FilterPanel />
            </div>
          </div>
        )}
        <SelectionBar />

        {/* Floating Action Button - Scroll to top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-24 right-4 z-40 rounded-2xl bg-amber-500 p-3 text-black shadow-2xl shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95 sm:bottom-10 sm:right-10 sm:p-4 sm:hover:-translate-y-1"
          >
            <ArrowUp size={24} />
          </button>
        )}

        {/* Progress Bar (at bottom) */}
        {activeTab === 'library' && pagePercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 z-50">
            <div className="w-full h-full bg-white/[0.04]">
              <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${pagePercent}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
