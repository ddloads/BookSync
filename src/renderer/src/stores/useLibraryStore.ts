import { create } from 'zustand'
import { toast } from 'sonner'
import { AuthStatus, Book, BookDetails, LogLevel, QueueItem } from '../types'
import { parseAudibleDate } from '../utils'
import { notifyError, notifyInfo, notifySuccess, useNotificationStore } from './useNotificationStore'
import { useFilterStore } from './useFilterStore'

// Module-level flags for queue processing
let isProcessing = false
const MAX_CONCURRENT = 3
const activeDownloads = new Set<string>()

function hasCompleteBookDetails(details: BookDetails | undefined): boolean {
  if (!details) return false
  const description = details.description?.trim()
  const releaseDate = details.releaseDate?.trim()
  const publisher = details.publisher?.trim()

  return Boolean(
    description &&
    description !== 'Metadata from Audible CLI' &&
    releaseDate &&
    publisher
  )
}

function getErrorMessage(err: unknown): string {
  const raw = String((err as any)?.message ?? err ?? 'Unknown error')
  return raw.replace(/^Error invoking remote method '.*?': Error:\s*/i, '').trim()
}

function logClient(type: 'success' | 'error' | 'info', title: string, message: string) {
  window.api.logs.add(type, title, message).catch(() => {
    // Avoid breaking UI flows if logging fails.
  })
}

interface LibraryState {
  books: Book[]
  isSyncing: boolean
  syncProgress: {
    stage: string
    accountIndex: number
    accountTotal: number
    accountName?: string
    accountRegion?: string
    page?: number
    pageTotal?: number | null
    itemsFetched?: number
    totalBooks?: number
    message?: string
  } | null
  isScanning: boolean
  scanProgress: { current: number; total: number; filename: string } | null
  enrichProgress: { completed: number; total: number } | null
  isLoggedIn: boolean
  authStatus: AuthStatus
  accounts: any[]
  nasPath: string
  activationBytes: string
  azureUrl: string
  azureUsername: string
  azurePassword: string
  azureLibraryId: string
  exportFormat: 'm4b' | 'mp3'
  logLevel: LogLevel
  closeBehavior: 'exit' | 'tray'
  downloadingIds: Set<string>
  downloadProgress: Record<string, number>
  downloadSpeed: Record<string, number>
  downloadPhase: Record<string, 'download' | 'convert'>
  activeTab: string
  selectedBook: Book | null
  detailsCache: Record<string, BookDetails>
  detailsLoading: boolean

  // Selection state
  selectedIds: Set<string>

  // Queue state
  queue: QueueItem[]
  queuePaused: boolean
  showQueuePanel: boolean

  setBooks: (books: Book[]) => void
  setSyncProgress: (p: LibraryState['syncProgress']) => void
  setScanProgress: (p: { current: number; total: number; filename: string } | null) => void
  setEnrichProgress: (p: { completed: number; total: number } | null) => void
  setDownloadProgress: (bookId: string, progress: number, speed?: number) => void
  setDownloadPhase: (bookId: string, phase: 'download' | 'convert') => void
  setActiveTab: (tab: string) => void
  setSelectedBook: (book: Book | null) => void
  setNasPath: (path: string) => void
  setActivationBytes: (bytes: string) => void
  setAzureUrl: (url: string) => void
  setAzureUsername: (username: string) => void
  setAzurePassword: (password: string) => void
  setAzureLibraryId: (id: string) => void
  setExportFormat: (format: 'm4b' | 'mp3') => void
  setLogLevel: (level: LogLevel) => void
  setCloseBehavior: (behavior: 'exit' | 'tray') => void
  setDetailsCache: (bookId: string, details: BookDetails) => void
  setDetailsCacheBulk: (cache: Record<string, BookDetails>) => void

  // Selection actions
  toggleSelection: (bookId: string) => void
  selectAll: (bookIds: string[]) => void
  clearSelection: () => void

  loadLibrary: () => Promise<void>
  loadSettings: () => Promise<void>
  handleSync: () => Promise<void>
  handleScanNas: () => Promise<void>
  handleScanAzure: () => Promise<void>
  handleLogin: (region?: string) => Promise<void>
  handleLogout: () => Promise<void>
  handleDeleteAccount: (accountId: string) => Promise<void>
  handleDownload: (book: Book) => void
  handleToggleIgnore: (book: Book) => Promise<void>
  saveSettings: () => Promise<void>
  testAzureConnection: () => Promise<void>
  fetchBookDetails: (bookId: string) => Promise<void>
  handleRescan: (bookId: string) => Promise<void>
  handleRescanMany: (bookIds: string[]) => Promise<void>
  closeMenus: () => void

  // Queue actions
  addToQueue: (bookId: string) => void
  addManyToQueue: (bookIds: string[]) => void
  cancelDownload: (bookId: string) => void
  pauseQueue: () => void
  resumeQueue: () => void
  clearCompletedFromQueue: () => void
  toggleQueuePanel: () => void
  processQueue: () => Promise<void>
  retryDownload: (bookId: string) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  isSyncing: false,
  syncProgress: null,
  isScanning: false,
  scanProgress: null,
  enrichProgress: null,
  isLoggedIn: false,
  authStatus: 'unknown',
  accounts: [],
  nasPath: '',
  activationBytes: '',
  azureUrl: '',
  azureUsername: '',
  azurePassword: '',
  azureLibraryId: '',
  exportFormat: 'm4b',
  logLevel: 'standard',
  closeBehavior: 'exit',
  downloadingIds: new Set(),
  downloadProgress: {},
  downloadSpeed: {},
  downloadPhase: {},
  activeTab: 'library',
  selectedBook: null,
  detailsCache: {},
  detailsLoading: false,

  // Selection state
  selectedIds: new Set<string>(),

  // Queue state
  queue: [],
  queuePaused: false,
  showQueuePanel: false,

  setBooks: (books) => set({ books }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),
  setScanProgress: (p) => set({ scanProgress: p }),
  setEnrichProgress: (p) => set({ enrichProgress: p }),
  setDownloadProgress: (bookId, progress, speed) => set(s => {
    // Throttled update: only update store if progress changed significantly or it's completion
    if (progress > 0 && progress < 100 && s.downloadProgress[bookId] === progress) return s

    const queue = s.queue.map(q =>
      q.bookId === bookId && q.status !== 'completed' && q.status !== 'failed' && q.status !== 'cancelled'
        ? { ...q, progress, speed }
        : q
    )
    const nextSpeed = { ...s.downloadSpeed }
    if (speed !== undefined) nextSpeed[bookId] = speed
    return { downloadProgress: { ...s.downloadProgress, [bookId]: progress }, downloadSpeed: nextSpeed, queue }
  }),
  setDownloadPhase: (bookId, phase) => set(s => {
    // Also update queue item status to match phase
    const queueStatus = phase === 'convert' ? 'converting' as const : 'downloading' as const
    const queue = s.queue.map(q =>
      q.bookId === bookId && (q.status === 'downloading' || q.status === 'converting')
        ? { ...q, status: queueStatus }
        : q
    )
    return { downloadPhase: { ...s.downloadPhase, [bookId]: phase }, queue }
  }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedBook: (book) => set({ selectedBook: book }),
  setNasPath: (path) => set({ nasPath: path }),
  setActivationBytes: (bytes) => set({ activationBytes: bytes }),
  setAzureUrl: (url) => set({ azureUrl: url }),
  setAzureUsername: (username) => set({ azureUsername: username }),
  setAzurePassword: (password) => set({ azurePassword: password }),
  setAzureLibraryId: (id) => set({ azureLibraryId: id }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setLogLevel: (logLevel) => set({ logLevel }),
  setCloseBehavior: (closeBehavior) => set({ closeBehavior }),
  setDetailsCache: (bookId, details) => set(s => ({ detailsCache: { ...s.detailsCache, [bookId]: details } })),
  setDetailsCacheBulk: (cache) => set(s => ({ detailsCache: { ...s.detailsCache, ...cache } })),

  // Selection actions
  toggleSelection: (bookId) => set(s => {
    const next = new Set(s.selectedIds)
    if (next.has(bookId)) next.delete(bookId)
    else next.add(bookId)
    return { selectedIds: next }
  }),
  selectAll: (bookIds) => set({ selectedIds: new Set(bookIds) }),
  clearSelection: () => set({ selectedIds: new Set() }),

  loadLibrary: async () => {
    try {
      logClient('info', 'UI Library', 'Loading cached library and details')
      const [data, allDetails] = await Promise.all([window.api.library.get(), window.api.library.getAllDetails()])
      set({ books: data, selectedIds: new Set() })
      if (allDetails && Object.keys(allDetails).length > 0) set(s => ({ detailsCache: { ...s.detailsCache, ...allDetails } }))
      logClient('success', 'UI Library', `Loaded ${data.length} books`)

      // --- IPC Listeners ---

      // Listen for remote download triggers
      window.api.book.onDownloadRemote((bookId: string) => {
        const book = get().books.find(b => b.id === bookId);
        if (book) get().handleDownload(book);
      });

      window.api.book.onDownloadManyRemote((bookIds: string[]) => {
        get().addManyToQueue(bookIds);
      });

      // Download progress
      window.api.book.onDownloadProgress((data) => {
        get().setDownloadPhase(data.bookId, data.phase);
        get().setDownloadProgress(data.bookId, data.progress, data.speed);
      });

      // Library sync progress
      window.api.library.onSyncProgress((data) => {
        set({ syncProgress: data });
      });

      // NAS scan progress
      window.api.library.onScanProgress((data) => {
        set({ scanProgress: data });
      });

      // Metadata enrichment
      window.api.library.onEnrichProgress((data) => {
        set({ enrichProgress: { completed: data.completed, total: data.total } });
        if (data.details) {
          get().setDetailsCache(data.bookId, data.details);
        }
      });

      window.api.library.onEnrichComplete(() => {
        set({ enrichProgress: null });
      });

      // Remote data changes
      window.api.library.onRemoteChanged(() => {
        get().loadLibrary();
      });

    } catch { /* empty on first launch */ }
  },

  loadSettings: async () => {
    try {
      logClient('info', 'UI Settings', 'Loading persisted settings')
      const [
        path,
        bytes,
        azureUrl,
        azureUsername,
        azurePassword,
        azureLibraryId,
        logLevel,
        format,
        closeBehavior,
        accounts,
      ] = await Promise.all([
        window.api.settings.get('nasPath', '/downloads'),
        window.api.settings.get('activationBytes', ''),
        window.api.settings.get('azureUrl', ''),
        window.api.settings.get('azureUsername', ''),
        window.api.settings.get('azurePassword', ''),
        window.api.settings.get('azureLibraryId', ''),
        window.api.settings.get('logLevel', 'standard'),
        window.api.settings.get('exportFormat', 'm4b'),
        window.api.settings.get('closeBehavior', 'exit'),
        window.api.account.list(),
      ])
      const normalizedLogLevel: LogLevel = logLevel === 'error' || logLevel === 'verbose' ? logLevel : 'standard'
      const normalizedFormat = (format === 'mp3' ? 'mp3' : 'm4b') as 'm4b' | 'mp3'
      const normalizedCloseBehavior = closeBehavior === 'tray' ? 'tray' : 'exit'
      set({
        nasPath: path,
        activationBytes: bytes,
        azureUrl,
        azureUsername,
        azurePassword,
        azureLibraryId,
        logLevel: normalizedLogLevel,
        exportFormat: normalizedFormat,
        closeBehavior: normalizedCloseBehavior,
        accounts,
      })
      
      if (accounts && accounts.length > 0) {
        set({ isLoggedIn: true, authStatus: 'authenticated' })
      } else {
        set({ isLoggedIn: false, authStatus: 'unauthenticated' })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      logClient('error', 'UI Settings', `Failed to load settings: ${String((err as any)?.message ?? err)}`)
      set({ isLoggedIn: false, authStatus: 'unknown' })
    }
  },

  handleSync: async () => {
    const accounts = get().accounts
    if (accounts.length === 0) {
      notifyError('No Audible accounts connected', { description: 'Please add an account in Settings first.' })
      return
    }

    set({ isSyncing: true, syncProgress: null })
    const toastId = toast.loading('Syncing Audible library...')
    try {
      logClient('info', 'UI Sync', `Starting sync for ${accounts.length} accounts`)
      const data = await window.api.library.sync()
      set({ books: data })
      notifySuccess(`Synced ${data.length} books`, {
        id: toastId,
        activityTitle: 'Library Synced',
        activityDescription: `Successfully imported ${data.length} books from ${accounts.length} accounts.`
      })
      logClient('success', 'UI Sync', `Sync complete: ${data.length} books`)
    } catch (err: any) {
      const msg = getErrorMessage(err)
      notifyError('Sync failed', { id: toastId, description: msg, activityTitle: 'Sync Failed', activityDescription: msg })
      logClient('error', 'UI Sync', `Sync failed: ${msg}`)
    } finally {
      set({ isSyncing: false, syncProgress: null })
    }
  },

  handleScanNas: async () => {
    set({ isScanning: true })
    const toastId = toast.loading('Scanning NAS for audiobooks...')
    try {
      logClient('info', 'UI NAS Scan', 'Starting NAS scan')
      const data = await window.api.library.scanNas()
      set(s => ({
        books: data,
        selectedBook: s.selectedBook ? (data.find((b: Book) => b.id === s.selectedBook!.id) ?? s.selectedBook) : null
      }))
      const foundCount = data.filter((b: Book) => b.isDownloaded).length
      notifySuccess(`Scan complete! Found ${foundCount} books on NAS.`, {
        id: toastId,
        activityTitle: 'NAS Scan Complete',
        activityDescription: `Matched ${foundCount} audiobooks from your network folder.`
      })
      logClient('success', 'UI NAS Scan', `Scan complete: ${foundCount} matched`)
    } catch (err: any) {
      const msg = getErrorMessage(err)
      notifyError('Scan failed', { id: toastId, description: msg, activityTitle: 'Scan Failed', activityDescription: msg })
      logClient('error', 'UI NAS Scan', `Scan failed: ${msg}`)
    } finally {
      set({ isScanning: false })
    }
  },

  handleScanAzure: async () => {
    const { azureUrl, azureUsername, azurePassword, azureLibraryId } = get()

    if (!azureUrl || !azureUsername || !azurePassword || !azureLibraryId) {
      notifyError('Azure server not configured', { description: 'Please set up Azure in Settings first.' })
      logClient('error', 'UI Azure Scan', 'Attempted Azure scan without complete configuration')
      return
    }

    set({ isScanning: true })
    const toastId = toast.loading('Syncing status with Azure server...')
    try {
      logClient('info', 'UI Azure Scan', 'Starting Azure scan')
      const data = await window.api.library.scanAzure()
      set((s) => ({
        books: data,
        selectedBook: s.selectedBook ? (data.find((b: Book) => b.id === s.selectedBook!.id) ?? s.selectedBook) : null,
      }))
      const foundCount = data.filter((b: Book) => b.isInAbs).length
      notifySuccess(`Azure sync complete! ${foundCount} books found in library.`, {
        id: toastId,
        activityTitle: 'Azure Sync Complete',
        activityDescription: `Matched ${foundCount} audiobooks from your Azure library.`,
      })
      logClient('success', 'UI Azure Scan', `Azure scan complete: ${foundCount} matched`)
    } catch (err: any) {
      const msg = getErrorMessage(err)
      notifyError('Azure sync failed', { id: toastId, description: msg, activityTitle: 'Azure Sync Failed', activityDescription: msg })
      logClient('error', 'UI Azure Scan', `Azure scan failed: ${msg}`)
    } finally {
      set({ isScanning: false })
    }
  },

  handleLogin: async (region: string = 'us') => {
    const toastId = toast.loading(`Opening Audible login (${region})...`)
    try {
      logClient('info', 'UI Auth', `Opening Audible login flow for ${region}`)
      const result = await window.api.auth.login(region)
      if (result.success) {
        const accounts = await window.api.account.list()
        set({ isLoggedIn: true, authStatus: 'authenticated', accounts })
        notifySuccess('Account connected successfully', { id: toastId })
        logClient('success', 'UI Auth', 'Account connected')
        // Trigger library sync automatically
        get().handleSync()
      } else if (result.cancelled) {
        toast.dismiss(toastId)
        notifyInfo('Login cancelled')
        logClient('info', 'UI Auth', 'Login cancelled by user')
      } else {
        notifyError(`Login failed: ${result.error}`, { id: toastId })
        logClient('error', 'UI Auth', `Login failed: ${result.error}`)
      }
    } catch (err: any) {
      notifyError(`Login failed: ${getErrorMessage(err)}`, { id: toastId })
      logClient('error', 'UI Auth', 'Login failed with exception')
    }
  },

  handleLogout: async () => {
    try {
      logClient('info', 'UI Auth', 'Logging out all accounts')
      await window.api.auth.logout()
      set({ isLoggedIn: false, authStatus: 'unauthenticated', accounts: [] })
      notifySuccess('All accounts disconnected.', {
        activityTitle: 'Accounts Disconnected',
        activityDescription: 'Logged out and cleared all accounts.'
      })
      logClient('success', 'UI Auth', 'Global logout successful')
    } catch {
      notifyError('Failed to logout')
      logClient('error', 'UI Auth', 'Logout failed')
    }
  },

  handleDeleteAccount: async (accountId: string) => {
    try {
      await window.api.account.delete(accountId)
      const accounts = await window.api.account.list()
      set({ accounts, isLoggedIn: accounts.length > 0, authStatus: accounts.length > 0 ? 'authenticated' : 'unauthenticated' })
      notifySuccess('Account disconnected')
      logClient('success', 'UI Auth', `Account deleted: ${accountId}`)
    } catch (err) {
      notifyError('Failed to disconnect account')
      logClient('error', 'UI Auth', `Failed to delete account ${accountId}`)
    }
  },

  // Now routes through the queue instead of downloading directly
  handleDownload: (book: Book) => {
    get().addToQueue(book.id)
  },

  handleToggleIgnore: async (book: Book) => {
    await window.api.book.toggleIgnore(book.id)
    const newIgnored = !book.isIgnored
    set(s => ({
      books: s.books.map(b => b.id === book.id ? { ...b, isIgnored: newIgnored } : b),
      selectedBook: s.selectedBook?.id === book.id ? { ...s.selectedBook, isIgnored: newIgnored } : s.selectedBook
    }))
    notifySuccess(newIgnored ? `"${book.title}" hidden from library` : `"${book.title}" restored to library`)
  },

  saveSettings: async () => {
    const {
      nasPath,
      activationBytes,
      azureUrl,
      azureUsername,
      azurePassword,
      azureLibraryId,
      logLevel,
      exportFormat,
      closeBehavior,
    } = get()
    try {
      logClient('info', 'UI Settings', 'Saving settings')
      const settingsToSave: Promise<unknown>[] = [
        window.api.settings.set('nasPath', nasPath),
        window.api.settings.set('azureUrl', azureUrl),
        window.api.settings.set('azureUsername', azureUsername),
        window.api.settings.set('azurePassword', azurePassword),
        window.api.settings.set('azureLibraryId', azureLibraryId),
        // Stored token is no longer valid if any of the auth inputs changed;
        // wipe it so the next call logs in fresh.
        window.api.settings.set('azureToken', ''),
        window.api.settings.set('logLevel', logLevel),
        window.api.settings.set('exportFormat', exportFormat),
        window.api.settings.set('closeBehavior', closeBehavior),
      ]

      if (activationBytes.trim()) {
        settingsToSave.push(window.api.settings.set('activationBytes', activationBytes))
      }

      await Promise.all(settingsToSave)
      notifySuccess('Settings saved successfully')
      logClient('success', 'UI Settings', 'Settings saved')
    } catch {
      notifyError('Failed to save settings')
      logClient('error', 'UI Settings', 'Failed to save settings')
    }
  },

  testAzureConnection: async () => {
    const { azureUrl, azureUsername, azurePassword, azureLibraryId } = get()
    if (!azureUrl || !azureUsername || !azurePassword || !azureLibraryId) {
      notifyError('Missing Azure configuration', {
        description: 'Please fill in URL, username, password, and library ID.',
      })
      logClient('error', 'UI Azure Test', 'Attempted connection test with missing fields')
      return
    }

    logClient('info', 'UI Azure Test', 'Testing Azure connection')
    const result = await window.api.settings.testAzure(azureUrl, azureUsername, azurePassword, azureLibraryId)
    if (result.success) {
      notifySuccess('Connection successful!', { description: `Found library: ${result.libraryName}` })
      logClient('success', 'UI Azure Test', `Connection successful: ${result.libraryName ?? 'unknown library'}`)
    } else {
      notifyError('Connection failed', { description: result.error })
      logClient('error', 'UI Azure Test', `Connection failed: ${result.error ?? 'unknown error'}`)
    }
  },

  fetchBookDetails: async (bookId: string) => {
    const cached = get().detailsCache[bookId]
    if (hasCompleteBookDetails(cached)) return
    set({ detailsLoading: true })
    try {
      const details = await window.api.book.getDetails(bookId)
      set(s => {
        const updatedBooks = s.books.map(b => {
          if (b.id !== bookId) return b
          const updates: Partial<Book> = {}
          if (!b.duration && details.duration) updates.duration = details.duration
          return Object.keys(updates).length > 0 ? { ...b, ...updates } : b
        })
        return { detailsCache: { ...s.detailsCache, [bookId]: details }, books: updatedBooks }
      })
    } catch {
      set(s => ({
        detailsCache: {
          ...s.detailsCache,
          [bookId]: { description: '', duration: '', releaseDate: '', publisher: '', format: '', language: '', rating: null, categories: [], copyright: '', seriesSequence: '', infoLink: `https://www.audible.com/pd/${bookId}` }
        }
      }))
    } finally {
      set({ detailsLoading: false })
    }
  },

  handleRescan: async (bookId: string) => {
    const toastId = toast.loading('Rescanning title on NAS...')
    try {
      const updatedBook = await window.api.book.rescan(bookId)
      set(s => ({
        books: s.books.map(b => b.id === bookId ? updatedBook : b),
        selectedBook: s.selectedBook?.id === bookId ? updatedBook : s.selectedBook
      }))
      if (updatedBook.isDownloaded) {
        notifySuccess(`"${updatedBook.title}" found on NAS`, { id: toastId })
      } else {
        notifyInfo(`"${updatedBook.title}" not found on NAS`, { id: toastId })
      }
    } catch (err) {
      notifyError('Rescan failed', { id: toastId, description: getErrorMessage(err) })
    }
  },

  handleRescanMany: async (bookIds: string[]) => {
    const toastId = toast.loading(`Rescanning ${bookIds.length} titles on NAS...`)
    try {
      const updatedBooks: Book[] = await window.api.book.rescanMany(bookIds)
      const updatedMap = new Map(updatedBooks.map(b => [b.id, b]))
      set(s => ({
        books: s.books.map(b => updatedMap.get(b.id) ?? b),
        selectedBook: s.selectedBook ? (updatedMap.get(s.selectedBook.id) ?? s.selectedBook) : null
      }))
      const foundCount = updatedBooks.filter(b => b.isDownloaded).length
      const notFoundCount = updatedBooks.length - foundCount
      if (notFoundCount === 0) {
        notifySuccess(`All ${foundCount} titles found on NAS`, { id: toastId })
      } else if (foundCount === 0) {
        notifyInfo(`None of the ${notFoundCount} titles found on NAS`, { id: toastId })
      } else {
        notifySuccess(`${foundCount} found, ${notFoundCount} not found on NAS`, { id: toastId })
      }
    } catch (err) {
      notifyError('Rescan failed', { id: toastId, description: getErrorMessage(err) })
    }
  },

  closeMenus: () => {
    useNotificationStore.getState().hideNotifications()
    useFilterStore.getState().setShowSortMenu(false)
    useFilterStore.getState().setShowSecondarySortMenu(false)
  },

  // --- Queue actions ---

  addToQueue: (bookId: string) => {
    const { queue, books } = get()
    // Don't add if already in queue with an active status
    if (queue.some(q => q.bookId === bookId && (q.status === 'queued' || q.status === 'downloading' || q.status === 'converting'))) {
      notifyInfo('Book already in download queue')
      return
    }
    const book = books.find(b => b.id === bookId)
    const item: QueueItem = { bookId, status: 'queued', progress: 0, addedAt: Date.now() }
    set(s => ({ queue: [...s.queue, item] }))
    notifySuccess(`"${book?.title || 'Book'}" added to queue`, {
      duration: 1500,
      activityTitle: 'Added to Queue',
      activityDescription: `"${book?.title || 'Book'}" is now waiting to download.`
    })
    logClient('info', 'UI Queue', `Added book to queue: ${bookId}`)
    get().processQueue()
  },

  addManyToQueue: (bookIds: string[]) => {
    const { queue, books } = get()
    const activeIds = new Set(queue.filter(q => q.status === 'queued' || q.status === 'downloading' || q.status === 'converting').map(q => q.bookId))
    const newItems: QueueItem[] = bookIds
      .filter(id => !activeIds.has(id))
      .map(bookId => ({ bookId, status: 'queued' as const, progress: 0, addedAt: Date.now() }))
    if (newItems.length === 0) {
      notifyInfo('All selected books are already in queue', { duration: 1500 })
      return
    }
    set(s => ({ queue: [...s.queue, ...newItems] }))
    notifySuccess(`Added ${newItems.length} books to download queue`, {
      duration: 1500,
      activityTitle: 'Bulk Queue',
      activityDescription: `Added ${newItems.length} books to the download queue.`
    })
    logClient('info', 'UI Queue', `Added ${newItems.length} books to queue`)
    get().processQueue()
  },

  cancelDownload: (bookId: string) => {
    const { queue } = get()
    const item = queue.find(q => q.bookId === bookId)
    if (!item) return

    if (item.status === 'queued') {
      // Remove from queue immediately if it hasn't started
      set(s => ({ queue: s.queue.filter(q => q.bookId !== bookId) }))
      logClient('info', 'UI Queue', `Removed queued item: ${bookId}`)
    } else if (item.status === 'downloading' || item.status === 'converting') {
      // Confirm cancellation locally so the queue UI responds immediately.
      ;(async () => {
        try {
          const result = await window.api.book.cancelDownload(bookId)
          if (!result.cancelled) {
            logClient('error', 'UI Queue', `Cancel request was rejected for ${bookId}`)
            notifyInfo('Unable to cancel this download right now')
            return
          }

          set(s => {
            const nextIds = new Set(s.downloadingIds)
            nextIds.delete(bookId)
            const nextProgress = { ...s.downloadProgress }
            delete nextProgress[bookId]
            const nextSpeed = { ...s.downloadSpeed }
            delete nextSpeed[bookId]
            const nextPhase = { ...s.downloadPhase }
            delete nextPhase[bookId]

            return {
              queue: s.queue.map(q =>
                q.bookId === bookId ? { ...q, status: 'cancelled' as const, error: 'Cancelled by user' } : q
              ),
              downloadingIds: nextIds,
              downloadProgress: nextProgress,
              downloadSpeed: nextSpeed,
              downloadPhase: nextPhase
            }
          })

          logClient('info', 'UI Queue', `Cancelled active item: ${bookId}`)
        } catch (err) {
          const msg = getErrorMessage(err)
          logClient('error', 'UI Queue', `Cancel failed for ${bookId}: ${msg}`)
          notifyError(`Cancel failed: ${msg}`)
        }
      })()
    }
  },

  pauseQueue: () => {
    set({ queuePaused: true })
    logClient('info', 'UI Queue', 'Queue paused')
  },

  resumeQueue: () => {
    set({ queuePaused: false })
    logClient('info', 'UI Queue', 'Queue resumed')
    get().processQueue()
  },

  clearCompletedFromQueue: () => {
    set(s => ({ queue: s.queue.filter(q => q.status === 'queued' || q.status === 'downloading' || q.status === 'converting') }))
    logClient('info', 'UI Queue', 'Cleared completed queue items')
  },

  toggleQueuePanel: () => {
    set(s => ({ showQueuePanel: !s.showQueuePanel }))
  },

  retryDownload: (bookId: string) => {
    // Remove the failed/cancelled item, re-add as queued
    set(s => ({
      queue: s.queue.map(q =>
        q.bookId === bookId ? { ...q, status: 'queued' as const, progress: 0, error: undefined, addedAt: Date.now() } : q
      )
    }))
    logClient('info', 'UI Queue', `Retry requested: ${bookId}`)
    get().processQueue()
  },

  processQueue: async () => {
    if (isProcessing) return
    isProcessing = true

    try {
      while (true) {
        const { queue, queuePaused, books } = get()
        if (queuePaused) break

        // Check if we can start more downloads
        if (activeDownloads.size >= MAX_CONCURRENT) break

        const nextItem = queue.find(q => q.status === 'queued' && !activeDownloads.has(q.bookId))
        if (!nextItem) break

        const book = books.find(b => b.id === nextItem.bookId)
        if (!book) {
          set(s => ({
            queue: s.queue.map(q => q.bookId === nextItem.bookId ? { ...q, status: 'failed', error: 'Book not found' } : q)
          }))
          continue
        }

        // Start this download without awaiting it to allow concurrency
        activeDownloads.add(nextItem.bookId)
        
        // Mark as downloading
        set(s => ({
          queue: s.queue.map(q => q.bookId === nextItem.bookId ? { ...q, status: 'downloading', progress: 0 } : q),
          downloadingIds: new Set(s.downloadingIds).add(nextItem.bookId)
        }))

        // Trigger the actual download process (async, non-blocking)
        ;(async () => {
          try {
            const result = await window.api.book.download(nextItem.bookId)
            if (!result.success) {
              const isCancelled = result.cancelled === true
              if (isCancelled) {
                // Remove from queue if cancelled
                set(s => ({ queue: s.queue.filter(q => q.bookId !== nextItem.bookId) }))
              } else {
                const msg = result.error || 'Download failed'
                set(s => ({
                  queue: s.queue.map(q => q.bookId === nextItem.bookId ? { ...q, status: 'failed', error: msg } : q)
                }))
                notifyError(`${book.title}: ${msg}`, {
                  activityTitle: 'Download Failed',
                  activityDescription: `${book.title}: ${msg}`
                })
                logClient('error', 'UI Queue', `Download failed for ${nextItem.bookId}: ${msg}`)
              }
            } else {
              const completedAt = new Date().toISOString()
              set(s => ({
                queue: s.queue.map(q => q.bookId === nextItem.bookId ? { ...q, status: 'completed', progress: 100 } : q),
                books: s.books.map(b => b.id === nextItem.bookId ? { ...b, isDownloaded: true, lastDownloadAt: completedAt } : b),
                selectedBook: s.selectedBook?.id === nextItem.bookId ? { ...s.selectedBook, isDownloaded: true, lastDownloadAt: completedAt } : s.selectedBook
              }))
              notifySuccess(`${book.title} saved to NAS`, {
                activityTitle: 'Download Complete',
                activityDescription: `${book.title} exported to NAS.`
              })
              logClient('success', 'UI Queue', `Download complete for ${nextItem.bookId}`)
            }
          } catch (err: any) {
            const msg = getErrorMessage(err)
            const lowerMsg = msg.toLowerCase()
            const isCancelled = lowerMsg.includes('cancelled') || lowerMsg.includes('canceled') || lowerMsg.includes('aborted') || lowerMsg.includes('abort')
            
            if (isCancelled) {
              set(s => ({ queue: s.queue.filter(q => q.bookId !== nextItem.bookId) }))
            } else {
              set(s => ({
                queue: s.queue.map(q => q.bookId === nextItem.bookId ? { ...q, status: 'failed', error: msg } : q)
              }))
              notifyError(`${book.title}: ${msg}`, {
                activityTitle: 'Download Failed',
                activityDescription: `${book.title}: ${msg}`
              })
              logClient('error', 'UI Queue', `Download failed for ${nextItem.bookId}: ${msg}`)
            }
          } finally {
            activeDownloads.delete(nextItem.bookId)
            // Clean up downloadingIds and downloadPhase
            set(s => {
              const nextIds = new Set(s.downloadingIds)
              nextIds.delete(nextItem.bookId)
              const nextProgress = { ...s.downloadProgress }
              delete nextProgress[nextItem.bookId]
              const nextPhase = { ...s.downloadPhase }
              delete nextPhase[nextItem.bookId]
              return { downloadingIds: nextIds, downloadProgress: nextProgress, downloadPhase: nextPhase }
            })
            // Continue processing the queue
            isProcessing = false
            get().processQueue()
          }
        })()
      }
    } finally {
      isProcessing = false
    }
  },
}))
