import { useEffect, useMemo, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { ArrowUp, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
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
import { MobileTopBar } from './components/MobileTopBar'
import { MobileBottomNav } from './components/MobileBottomNav'
import { MobileDrawer } from './components/MobileDrawer'
import { useFilteredBooks } from './hooks/useFilteredBooks'
import { useIsMobile } from './hooks/useIsMobile'

function App() {
  const {
    books,
    loadLibrary,
    loadSettings,
    activeTab,
    selectedBook,
    showQueuePanel,
    toggleQueuePanel
  } = useLibraryStore()

  const showFilterPanel = useFilterStore(s => s.showFilterPanel)
  const setShowFilterPanel = useFilterStore(s => s.setShowFilterPanel)
  const viewMode = useFilterStore(s => s.viewMode)
  const { filteredBooks, activeFilterCount } = useFilteredBooks()

  const {
    showNotifications,
    hideNotifications,
    addNotification
  } = useNotificationStore()

  const isMobile = useIsMobile()
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  const filteredBookIds = useMemo(() => filteredBooks.map(b => b.id), [filteredBooks])

  const pagePercent = useMemo(() => {
    if (activeTab !== 'library' || filteredBooks.length === 0) return 0
    return 0
  }, [activeTab, filteredBooks.length])

  // On mobile, the list view's 800px-min table is unusable; force grid.
  const effectiveViewMode = isMobile ? 'grid' : viewMode

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

      {/* Desktop sidebar (lg+) */}
      <Sidebar />

      {/* Mobile shell (<lg) */}
      <MobileTopBar onOpenDrawer={() => setDrawerOpen(true)} />
      <MobileBottomNav />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex-1 flex flex-col relative min-h-0 min-w-0">
        {showNotifications && (
          <>
            <div
              className="fixed inset-0 z-40 animate-sheet-fade bg-black/40 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none"
              onClick={hideNotifications}
            />
            <NotificationCenter />
          </>
        )}

        <main
          ref={mainScrollRef}
          className="flex-1 min-h-0 overflow-y-auto relative custom-scrollbar mobile-shell-top mobile-shell-bottom lg:!pt-0 lg:!pb-0"
        >
          {activeTab === 'library' && (
            <div className="px-4 pb-6 pt-4 md:p-8 lg:p-10">
              {/* Header */}
              <header className="mb-6 flex flex-col justify-between gap-5 lg:mb-10 xl:flex-row xl:items-end">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="hidden h-8 w-2 rounded-full bg-amber-500 sm:block" />
                    <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                      Library
                      <span className="text-base font-bold tabular-nums text-slate-700 sm:text-xl md:text-2xl">
                        {books.length}
                      </span>
                    </h1>
                  </div>
                  <p className="ml-0 hidden max-w-2xl text-sm font-medium text-slate-500 sm:ml-5 sm:block md:text-base">
                    Manage and sync your audiobook collection
                  </p>
                </div>

                {/* Desktop-only quick actions (mobile/tablet uses ControlsBar + bottom nav) */}
                <div className="hidden gap-3 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:justify-start xl:justify-end">
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
                    activeFilterCount={activeFilterCount}
                  />

                  {filteredBooks.length > 0 ? (
                    effectiveViewMode === 'grid' ? (
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
          <div className="fixed inset-0 z-50 flex items-end justify-end lg:items-stretch">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-sheet-fade"
              onClick={() => setShowFilterPanel(false)}
            />
            <div className="relative w-full max-h-[92dvh] animate-sheet-up lg:h-full lg:max-h-none lg:w-[min(100vw-1rem,44rem)] lg:animate-none lg:p-3 lg:pl-0 lg:pr-3 lg:pt-3">
              <FilterPanel />
            </div>
          </div>
        )}
        <SelectionBar />

        {/* Floating Action Button - Scroll to top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 rounded-2xl bg-amber-500 p-3 text-black shadow-2xl shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95 lg:bottom-10 lg:right-10 lg:p-4 lg:hover:-translate-y-1"
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
