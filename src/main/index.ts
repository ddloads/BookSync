import { app, BrowserWindow, ipcMain, Menu, nativeImage, session, Tray } from 'electron'
import { join } from 'path'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { ChildProcess } from 'child_process'
import { AudibleService } from './AudibleService'
import { DatabaseService } from './DatabaseService'
import { ExportService } from './ExportService'
import { ScanService } from './ScanService'
import { ServerService } from './ServerService'
import { AaxCache } from './AaxCache'
import { AbsLibraryItem, decideAbsMatches } from './absSync'
import {
  AzureConfig,
  azureFetchLibraryItems,
  azureListLibraries,
  azureTestConnection,
  azureTriggerScan,
  describeAzureError,
} from './azureSync'
import type { Book } from './types'
import { scanAndMatchCore } from './scanCore'
import axios from 'axios'

const isNasScanWorker = process.env.BOOKSYNC_SCAN_WORKER === '1'

if (process.env.BOOKSYNC_DATA_DIR) {
  // Must set this before app is ready
  app.setPath('userData', path.resolve(process.env.BOOKSYNC_DATA_DIR))
}

// Support high-DPI monitors and fix multi-monitor maximization issues
if (!isNasScanWorker && process.platform === 'win32') {
  app.commandLine.appendSwitch('high-dpi-support', '1')
  // Fix for some Windows 10/11 multi-monitor maximization issues
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
  app.setAppUserModelId('com.ddsplayground.booksync')
}

const audibleService = new AudibleService()
const aaxCache = isNasScanWorker ? undefined : new AaxCache(app.getPath('userData'))
const exportService = new ExportService(aaxCache)
const scanService = new ScanService()
let dbService: DatabaseService
let serverService: ServerService
let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false
const enrichingWindows = new WeakSet<BrowserWindow>()

// --- Shared Core Actions (for IPC and API) ---

async function loginAction(region: string = 'us') {
  const loginStart = await audibleService.getExternalLoginUrl(region)
  const loginWin = new BrowserWindow({
    width: 800,
    height: 700,
    modal: true,
    parent: mainWindow || undefined,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true }
  })

  loginWin.loadURL(loginStart.oauth_url)

  return new Promise((resolve) => {
    let settled = false

    const handleUrl = async (url: string) => {
      if (settled) return
      if (url.includes('openid.oa2.authorization_code=')) {
        settled = true

        try {
          appLog('info', 'Auth', `Registering account for region: ${region}`)
          const authObj = await audibleService.registerFromExternalLogin(
            url,
            loginStart.serial,
            loginStart.code_verifier,
            region
          )

          const accountId = authObj.customer_info?.user_id || `acc_${Date.now()}`
          const accountName = authObj.customer_info?.name || `Account (${region})`
          const authData = JSON.stringify(authObj)

          dbService.saveAccount(accountId, accountName, region, authData)
          appLog('success', 'Auth', `Successfully connected account: ${accountName}`)

          loginWin.close()
          resolve({ success: true, accountId })
        } catch (err) {
          appLog('error', 'Auth', `Failed to register account: ${formatError(err)}`)
          loginWin.close()
          resolve({ success: false, error: String(err) })
        }
      }
    }

    loginWin.webContents.on('did-finish-load', () => {
      handleUrl(loginWin.webContents.getURL())
    })

    loginWin.webContents.on('did-navigate', (_event, url) => {
      handleUrl(url)
    })

    loginWin.on('closed', () => {
      if (!settled) resolve({ success: false, cancelled: true })
    })
  })
}

function getCloseBehaviorSetting(): 'exit' | 'tray' {
  if (!dbService) return 'exit'
  return dbService.getSetting('closeBehavior', 'exit') === 'tray' ? 'tray' : 'exit'
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.focus()
}

function resolveTrayImage() {
  const candidates = [
    join(app.getAppPath(), 'Logo.png'),
    join(app.getAppPath(), 'build', 'icon.ico'),
    join(app.getAppPath(), 'build', 'icon.png'),
    join(process.cwd(), 'Logo.png'),
    join(process.cwd(), 'build', 'icon.ico'),
    join(process.cwd(), 'build', 'icon.png'),
    join(app.getAppPath(), 'mobile', 'assets', 'icon.png'),
    join(process.cwd(), 'mobile', 'assets', 'icon.png'),
    process.execPath
  ]

  for (const candidate of candidates) {
    try {
      if (candidate !== process.execPath && !fs.existsSync(candidate)) continue
      const image = nativeImage.createFromPath(candidate)
      if (!image.isEmpty()) {
        return image
      }
    } catch {
      // Try next candidate.
    }
  }

  return nativeImage.createEmpty()
}

function createTray() {
  if (appTray) return appTray

  const trayImage = resolveTrayImage()
  appTray = new Tray(trayImage)
  appTray.setToolTip('BookSync')
  appTray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Open BookSync',
      click: () => showMainWindow()
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ]))

  appTray.on('click', () => showMainWindow())
  appTray.on('double-click', () => showMainWindow())

  return appTray
}

async function syncAudibleAction() {
  const accounts = dbService.getAccounts()
  if (accounts.length === 0) {
    throw new Error('No Audible accounts connected. Please go to Settings to add an account.')
  }

  let totalBooks = 0
  const emitSyncProgress = (data: Record<string, any>) => {
    mainWindow?.webContents.send('library:sync-progress', data)
  }

  emitSyncProgress({
    stage: 'starting',
    accountIndex: 0,
    accountTotal: accounts.length,
    totalBooks: 0,
    message: `Starting sync for ${accounts.length} account${accounts.length === 1 ? '' : 's'}`
  })

  for (const [index, account] of accounts.entries()) {
    appLog('info', 'Audible Sync', `Syncing account: ${account.name} (${account.region})`)
    const progressBase = {
      stage: 'account-start',
      accountIndex: index + 1,
      accountTotal: accounts.length,
      accountName: account.name,
      accountRegion: account.region,
      totalBooks,
      message: `Syncing ${account.name} (${account.region})`
    }
    emitSyncProgress(progressBase)
    serverService?.broadcast('library:sync-progress', progressBase)

    try {
      const syncedItems = await audibleService.getLibrary(account.auth_data, (progress) => {
        const progressData = {
          stage: progress.stage === 'completed' ? 'account-complete' : 'account-progress',
          accountIndex: index + 1,
          accountTotal: accounts.length,
          accountName: account.name,
          accountRegion: account.region,
          page: progress.page,
          pageTotal: progress.pageTotal,
          itemsFetched: progress.itemsFetched,
          totalBooks,
          message: progress.message
        }
        emitSyncProgress(progressData)
        // Throttle mobile broadcasts for page progress
        serverService?.broadcast('library:sync-progress', progressData)
      })
      const books = syncedItems.map(item => item.book)
      const taggedBooks = books.map(b => ({ ...b, accountId: account.id }))
      dbService.saveBooks(taggedBooks)
      for (const item of syncedItems) {
        const hasSeedDetails =
          String(item.details?.description ?? '').trim() !== '' ||
          String(item.details?.releaseDate ?? '').trim() !== '' ||
          String(item.details?.seriesSequence ?? '').trim() !== ''
        if (hasSeedDetails) dbService.saveBookDetails(item.book.id, item.details)
      }
      dbService.updateAccountSyncTime(account.id)
      totalBooks += books.length
      const savedData = {
        stage: 'account-saved',
        accountIndex: index + 1,
        accountTotal: accounts.length,
        accountName: account.name,
        accountRegion: account.region,
        itemsFetched: books.length,
        totalBooks,
        message: `Saved ${books.length} titles from ${account.name}`
      }
      emitSyncProgress(savedData)
      serverService?.broadcast('library:sync-progress', savedData)
    } catch (err) {
      const errorData = {
        stage: 'account-error',
        accountIndex: index + 1,
        accountTotal: accounts.length,
        accountName: account.name,
        accountRegion: account.region,
        totalBooks,
        message: formatError(err)
      }
      emitSyncProgress(errorData)
      serverService?.broadcast('library:sync-progress', errorData)
      appLog('error', 'Audible Sync', `Failed to sync account ${account.name}: ${formatError(err)}`)
    }
  }

  const completeData = {
    stage: 'completed',
    accountIndex: accounts.length,
    accountTotal: accounts.length,
    totalBooks,
    message: `Retrieved ${totalBooks} titles from ${accounts.length} accounts`
  }
  emitSyncProgress(completeData)
  serverService?.broadcast('library:sync-progress', completeData)

  dbService.addLog('success', 'Audible Sync Complete', `Retrieved ${totalBooks} titles from ${accounts.length} accounts.`)
  
  // Notify mobile devices
  serverService?.broadcast('library:updated', { source: 'audible' })

  // Try to enrich for any open windows
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    enrichLibrary(win).catch(console.error)
  }
  
  return dbService.getBooks()
}

async function scanNasAction(onProgress?: (data: any) => void) {
  const nasPath = dbService.getSetting('nasPath', '')
  if (!nasPath) throw new Error('NAS Path not set in Settings.')

  const books = dbService.getBooks()
  const foundResults = await scanService.scanAndMatch(nasPath, books, (current, total, filename) => {
    const progress = { current, total, filename, source: 'nas' }
    onProgress?.(progress)
    serverService?.broadcast('library:scan-progress', progress)
  })

  const foundMap = new Map<string, string>(foundResults.map((r) => [r.id, r.path]))
  dbService.updateBooksStatus(foundMap)

  // Notify mobile devices
  serverService?.broadcast('library:updated', { source: 'nas' })

  return dbService.getBooks()
}

function getAzureConfig(): AzureConfig | null {
  const url = dbService.getSetting('azureUrl', '')
  const username = dbService.getSetting('azureUsername', '')
  const password = dbService.getSetting('azurePassword', '')
  const libraryId = dbService.getSetting('azureLibraryId', '')
  if (!url || !username || !password || !libraryId) return null
  return { url, username, password, libraryId }
}

async function scanAzureAction() {
  const config = getAzureConfig()
  if (!config) {
    throw new Error('Azure server not configured in Settings.')
  }

  try {
    appLog('info', 'Azure Sync', `Starting scan for Library: ${config.libraryId} at ${config.url}`)
    serverService?.broadcast('library:scan-progress', {
      current: 0,
      total: 100,
      filename: 'Connecting to Azure server...',
      source: 'azure',
    })

    const azureItems = await azureFetchLibraryItems(dbService, config, (current, total) => {
      serverService?.broadcast('library:scan-progress', {
        current,
        total: total || 1,
        filename: `Fetching items (${current}/${total})...`,
        source: 'azure',
      })
    })

    serverService?.broadcast('library:scan-progress', {
      current: 95,
      total: 100,
      filename: 'Matching library...',
      source: 'azure',
    })
    const allBooks = dbService.getBooks()
    const decision = decideAbsMatches(allBooks, azureItems, {
      recentDownloadGraceMs: ABS_RECENT_DOWNLOAD_GRACE_MS,
    })

    dbService.updateAbsStatus(decision.foundIds, decision.shouldResetUnmatched)
    appLog('success', 'Azure Sync', `Matched ${decision.foundIds.size} / ${allBooks.length} books`)
    serverService?.broadcast('library:scan-progress', {
      current: 100,
      total: 100,
      filename: `Matched ${decision.foundIds.size} / ${allBooks.length} books`,
      source: 'azure',
    })
    serverService?.broadcast('library:updated', { source: 'azure' })
    return dbService.getBooks()
  } catch (err: any) {
    const errorMsg = describeAzureError(err, 'scan')
    throw new Error(`Azure scan failed: ${errorMsg}`)
  }
}

type AppLogType = 'success' | 'error' | 'info'
type LogLevel = 'error' | 'standard' | 'verbose'

function redactForLogs(value: unknown): unknown {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(redactForLogs)
  if (typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase()
    if (
      lk.includes('cookie') ||
      lk.includes('token') ||
      lk.includes('apikey') ||
      lk.includes('authorization') ||
      lk.includes('password')
    ) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = redactForLogs(v)
    }
  }
  return out
}

function formatError(err: unknown): string {
  const e = err as any
  const msg = String(e?.message ?? e ?? 'Unknown error')
  const code = e?.code ? ` code=${String(e.code)}` : ''
  const status = e?.response?.status ? ` status=${String(e.response.status)}` : ''
  return `${msg}${code}${status}`
}


function normalizeLogLevel(value: string | undefined): LogLevel {
  if (value === 'error' || value === 'verbose') return value
  return 'standard'
}

function generateCompanionApiKey(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function ensureCompanionApiKey(): string {
  let apiKey = dbService.getSetting('mobileServerApiKey', '')
  if (!apiKey) {
    apiKey = generateCompanionApiKey()
    dbService.setSetting('mobileServerApiKey', apiKey)
  }
  return apiKey
}

function getCompanionConnectionInfo() {
  const enabled = dbService.getSetting('mobileServerEnabled', 'false') === 'true'
  const defaultPort = process.env.PORT || '3005'
  const port = parseInt(dbService.getSetting('mobileServerPort', defaultPort), 10) || parseInt(defaultPort, 10)
  const publicUrl = dbService.getSetting('mobileServerPublicUrl', '').replace(/\/+$/, '')
  const apiKey = ensureCompanionApiKey()
  const interfaces = os.networkInterfaces()
  const hosts = Object.values(interfaces)
    .flatMap(addresses => addresses ?? [])
    .filter(address => address.family === 'IPv4' && !address.internal)
    .map(address => address.address)
    .filter((value, index, array) => array.indexOf(value) === index)

  const primaryHost = hosts[0] ?? '127.0.0.1'
  const httpUrl = `http://${primaryHost}:${port}`
  const wsUrl = `ws://${primaryHost}:${port}?apiKey=${encodeURIComponent(apiKey)}`
  
  // Build v2 QR payload with both local and public endpoints
  const qrParams = new URLSearchParams({
    version: '2',
    apiKey: apiKey,
    local: httpUrl,
  })
  if (publicUrl) {
    qrParams.set('public', publicUrl)
  }
  
  const qrPayload = `booksync://connect?${qrParams.toString()}`

  return {
    enabled,
    port,
    publicUrl,
    apiKey,
    hosts,
    primaryHost,
    httpUrl,
    wsUrl,
    qrPayload
  }
}

function getCurrentLogLevel(): LogLevel {
  if (!dbService) return 'verbose'
  return normalizeLogLevel(dbService.getSetting('logLevel', 'standard'))
}

function shouldWriteLog(requiredLevel: LogLevel): boolean {
  const rank: Record<LogLevel, number> = { error: 0, standard: 1, verbose: 2 }
  return rank[getCurrentLogLevel()] >= rank[requiredLevel]
}

function shouldPersistClientLog(type: AppLogType): boolean {
  const level = getCurrentLogLevel()
  if (level === 'error') return type === 'error'
  return true
}

function appLog(type: AppLogType, title: string, message: string, meta?: unknown, requiredLevel?: LogLevel) {
  const effectiveLevel: LogLevel = requiredLevel ?? (type === 'error' ? 'error' : 'standard')
  if (!shouldWriteLog(effectiveLevel)) return
  const safeMeta = meta ? redactForLogs(meta) : undefined
  const line = safeMeta ? `${message} | meta=${JSON.stringify(safeMeta)}` : message
  const prefix = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${title}`
  if (type === 'error') console.error(`${prefix} ${line}`)
  else console.log(`${prefix} ${line}`)
  if (dbService) {
    try {
      dbService.addLog(type, title, line)
    } catch {
      // Avoid crashing due to log persistence failures.
    }
  }
  if (type === 'error') {
    mainWindow?.webContents.send('log:activity', { type, title, message: line })
  }
}

function handleIpc(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any | Promise<any>
) {
  ipcMain.handle(channel, async (event, ...args) => {
    const started = Date.now()
    appLog('info', 'IPC Start', channel, { argCount: args.length }, 'verbose')
    try {
      const result = await handler(event, ...args)
      appLog('success', 'IPC Success', `${channel} (${Date.now() - started}ms)`, undefined, 'verbose')
      return result
    } catch (err) {
      appLog('error', 'IPC Error', `${channel} failed: ${formatError(err)}`, { argCount: args.length })
      throw err
    }
  })
}

function isCancellationError(err: any): boolean {
  const msg = String(err?.message ?? '').toLowerCase()
  const code = String(err?.code ?? '')
  return (
    msg.includes('canceled') ||
    msg.includes('cancelled') ||
    msg.includes('aborted') ||
    msg.includes('abort') ||
    code === 'ERR_CANCELED'
  )
}

// Active download tracking for cancellation (supports concurrent downloads)
const activeDownloads = new Map<string, { abortController: AbortController; ffmpegProcess: ChildProcess | null }>()
let companionQueueSnapshot: {
  queuePaused: boolean
  items: Array<{ bookId: string; status: 'queued' | 'downloading' | 'converting'; progress: number; phase?: 'download' | 'convert'; addedAt: number }>
} = { queuePaused: false, items: [] }

// Track the last emitted progress to handle phase changes and throttling correctly
const progressBroadcastState = new Map<string, { lastProgress: number; lastTime: number; lastPhase: string }>()

function shouldBroadcastProgress(bookId: string, progress: number, phase: string): boolean {
  const now = Date.now()
  const prev = progressBroadcastState.get(bookId)
  
  if (!prev || prev.lastPhase !== phase || Math.abs(progress - prev.lastProgress) >= 1 || now - prev.lastTime >= 500) {
    progressBroadcastState.set(bookId, { lastProgress: progress, lastTime: now, lastPhase: phase })
    return true
  }
  return false
}

const ABS_RECENT_DOWNLOAD_GRACE_MS = 30 * 60 * 1000
let pendingAzureScanConfig: AzureConfig | null = null

function hasCompleteBookDetails(details: any): boolean {
  if (!details) return false
  const description = String(details.description ?? '').trim()
  const releaseDate = String(details.releaseDate ?? '').trim()
  const publisher = String(details.publisher ?? '').trim()
  return description !== '' && description !== 'Metadata from Audible CLI' && releaseDate !== '' && publisher !== ''
}

/**
 * Background metadata enrichment — mirrors how OpenAudible calls getInfo() on
 * each book after the library list is fetched.  Runs 3 requests concurrently
 * with a 400 ms pause between batches so Audible doesn't rate-limit us.
 * Already-cached books are skipped so it only ever fetches each book once.
 */
async function enrichLibrary(mainWindow: BrowserWindow): Promise<void> {
  if (enrichingWindows.has(mainWindow)) return
  enrichingWindows.add(mainWindow)
  appLog('info', 'Metadata Enrichment', 'Background enrichment started')

  try {
    const books = dbService.getBooks()
    const accountsById = new Map(dbService.getAccounts().map((account: any) => [account.id, account]))
    const unenriched = books.filter(b => {
      const details = dbService.getBookDetails(b.id)
      return !hasCompleteBookDetails(details)
    })
    
    if (unenriched.length === 0) return
    appLog('info', 'Metadata Enrichment', `Queued ${unenriched.length} books for enrichment (new or incomplete)`)

    const total = unenriched.length
    let completed = 0
    const CONCURRENCY = 3
    const BATCH_DELAY_MS = 400

    for (let i = 0; i < unenriched.length; i += CONCURRENCY) {
      const batch = unenriched.slice(i, i + CONCURRENCY)

      // Fetch concurrently, then save sequentially to avoid write conflicts
      const results = await Promise.all(
        batch.map(async (book) => {
          try {
            const account = book.accountId ? accountsById.get(book.accountId) : null
            if (!account) return { book, details: null }
            const details = await audibleService.getBookDetails(account.auth_data, book.id)
            return { book, details }
          } catch {
            return { book, details: null }
          }
        })
      )

      for (const { book, details } of results) {
        if (details) dbService.saveBookDetails(book.id, details)
        completed++
        mainWindow.webContents.send('library:enrich-progress', {
          completed,
          total,
          bookId: book.id,
          details
        })
      }

      if (i + CONCURRENCY < unenriched.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    mainWindow.webContents.send('library:enrich-complete', { total })
    appLog('success', 'Metadata Enrichment', `Completed enrichment for ${total} books`)
  } finally {
    enrichingWindows.delete(mainWindow)
  }
}

function createWindow(): void {
  appLog('info', 'App Window', 'Creating main window')
  const appIcon = resolveTrayImage()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'BookSync',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      spellcheck: false
    }
  })
  const window = mainWindow

  // Completely remove menu for a cleaner look and to prevent layout shifts on Windows
  window.removeMenu()

  window.on('ready-to-show', () => {
    window.maximize()
    window.show()
    appLog('success', 'App Window', 'Main window ready, maximized and shown')
  })

  window.on('closed', () => {
    mainWindow = null
  })

  // --- Auth ---
  handleIpc('auth:login', async (_event, region: string = 'us') => {
    return loginAction(region)
  })

  handleIpc('account:list', () => {
    return dbService.getAccounts()
  })

  handleIpc('account:delete', (_event, accountId: string) => {
    dbService.deleteAccount(accountId)
    return true
  })

  handleIpc('auth:check-session', async () => {
    // For multi-account, we might want to check all or a specific one.
    // Simplifying to true for now as wrapper handles it.
    return true
  })

  handleIpc('auth:logout', async () => {
    // Clear all accounts or a specific one? 
    // Usually user expects to clear everything if they click global logout.
    const accounts = dbService.getAccounts()
    for (const acc of accounts) {
      dbService.deleteAccount(acc.id)
    }
    await session.defaultSession.clearStorageData({ storages: ['cookies'] })
    return true
  })

  // --- Library ---
  handleIpc('library:sync', async () => {
    return syncAudibleAction()
  })

  handleIpc('library:scan-nas', async () => {
    return scanNasAction((progress) => {
      window.webContents.send('library:scan-progress', progress)
    })
  })

  handleIpc('library:scan-azure', async () => {
    return scanAzureAction()
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    if (getCloseBehaviorSetting() !== 'tray') return

    event.preventDefault()
    createTray()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  handleIpc('library:update-queue-snapshot', (_event, snapshot: {
    queuePaused: boolean
    items: Array<{ bookId: string; status: 'queued' | 'downloading' | 'converting'; progress: number; phase?: 'download' | 'convert'; addedAt: number }>
  }) => {
    companionQueueSnapshot = {
      queuePaused: Boolean(snapshot?.queuePaused),
      items: Array.isArray(snapshot?.items) ? snapshot.items : []
    }
    return true
  })

  handleIpc('library:get', () => {
    return dbService.getBooks()
  })

  // --- Book Details ---
  handleIpc('book:details', async (_event, bookId: string) => {
    // Return cached details if already enriched
    const cached = dbService.getBookDetails(bookId)
    if (hasCompleteBookDetails(cached)) return cached
    const book = dbService.getBooks().find(b => b.id === bookId)
    if (!book) throw new Error('Book not found in database.')
    const accountId = book.accountId
    if (!accountId) throw new Error('No account associated with this book.')
    const account = dbService.getAccount(accountId)
    if (!account) throw new Error(`Account not found for this book (ID: ${accountId})`)
    // Otherwise fetch and cache for next time
    const details = await audibleService.getBookDetails(account.auth_data, bookId)
    dbService.saveBookDetails(bookId, details)
    return details
  })

  handleIpc('library:get-all-details', () => {
    return dbService.getAllBookDetails()
  })

  handleIpc('book:rescan', async (_event, bookId: string) => {
    const nasPath = dbService.getSetting('nasPath', '')
    if (!nasPath) throw new Error('NAS Path not set in Settings.')

    const book = dbService.getBooks().find(b => b.id === bookId)
    if (!book) throw new Error('Book not found in database.')

    const foundResults = await scanService.scanAndMatch(nasPath, [book])
    const found = foundResults.find(r => r.id === book.id)

    dbService.updateBookStatus(book.id, !!found, found?.path)
    serverService?.broadcast('library:updated', { source: 'rescan', bookId: book.id, isDownloaded: !!found })

    return dbService.getBooks().find(b => b.id === bookId)
  })

  handleIpc('book:rescan-many', async (_event, bookIds: string[]) => {
    const nasPath = dbService.getSetting('nasPath', '')
    if (!nasPath) throw new Error('NAS Path not set in Settings.')

    const allBooks = dbService.getBooks()
    const books = bookIds.map(id => allBooks.find(b => b.id === id)).filter(Boolean) as Book[]
    if (books.length === 0) return []

    const foundResults = await scanService.scanAndMatch(nasPath, books)

    for (const book of books) {
      const found = foundResults.find(r => r.id === book.id)
      dbService.updateBookStatus(book.id, !!found, found?.path)
      serverService?.broadcast('library:updated', { source: 'rescan', bookId: book.id, isDownloaded: !!found })
    }

    const updatedBooks = dbService.getBooks()
    return bookIds.map(id => updatedBooks.find(b => b.id === id)).filter(Boolean)
  })

  // --- Download ---
  handleIpc('book:download', async (_event, bookId: string) => {
    const books = dbService.getBooks()
    const book = books.find(b => b.id === bookId)
    if (!book) throw new Error('Book not found in database.')

    // Find account
    const accountId = (book as any).accountId
    if (!accountId) throw new Error('No account associated with this book. Try syncing your library.')
    
    const account = dbService.getAccount(accountId)
    if (!account) throw new Error(`Account not found for this book (ID: ${accountId})`)

    const nasPath = dbService.getSetting('nasPath', '')
    if (!nasPath) throw new Error('NAS Path not set in Settings.')

    const exportFormat = dbService.getSetting('exportFormat', 'm4b') as 'm4b' | 'mp3'
    if (activeDownloads.has(bookId)) {
      return { success: false, cancelled: false, error: 'Download already in progress' }
    }

    // Set up cancellation
    const abortController = new AbortController()
    activeDownloads.set(bookId, { abortController, ffmpegProcess: null })

    try {
      appLog('info', 'Download', `Fetching download URL and activation bytes for ${book.title}`)
      
      // 1. Get download URL and activation bytes and book details concurrently
      const [downloadUrlObj, activationBytes, details] = await Promise.all([
        audibleService.getDownloadUrl(account.auth_data, book.id),
        audibleService.getActivationBytes(account.auth_data),
        Promise.resolve(dbService.getBookDetails(book.id)).then(cached =>
          cached ?? audibleService.getBookDetails(account.auth_data, book.id).catch(() => null)
        )
      ]);
      
      const downloadUrl = downloadUrlObj.download_url
      if (!downloadUrl) throw new Error('Failed to retrieve download URL from Audible.')

      const audibleVoucher = downloadUrlObj.voucher
        ? { key: String(downloadUrlObj.voucher.key), iv: String(downloadUrlObj.voucher.iv) }
        : null
      const audibleFormat = (downloadUrlObj.format === 'aaxc' ? 'aaxc' : 'aax') as 'aax' | 'aaxc'

      const finalPath = await exportService.downloadAndConvertStream(
        downloadUrl,
        book,
        details,
        nasPath,
        activationBytes,
        '', // Cookies not needed anymore if using the direct offline_url
        ({ progress, speed, phase }) => {
          const currentPhase = phase || 'download'
          
          // Unified 0-100% progress: 0-90% for download, 90-100% for conversion
          let unifiedProgress = progress
          if (currentPhase === 'download') {
            unifiedProgress = Math.round(progress * 0.9)
          } else if (currentPhase === 'convert') {
            unifiedProgress = 90 + Math.round(progress * 0.1)
          }

          const progressData = { 
            bookId, 
            progress: unifiedProgress, 
            speed, 
            phase: currentPhase,
            phaseProgress: progress // Raw 0-100 for current phase
          }
          
          mainWindow?.webContents.send('book:download-progress', progressData)
          
          if (shouldBroadcastProgress(bookId, unifiedProgress, currentPhase)) {
            serverService?.broadcast('book:download-progress', progressData)
            dbService.updateDownloadProgress(bookId, unifiedProgress, currentPhase)
          }
        },
        (type, title, message) => {
          appLog(type as any, title, message)
        },
        (ffmpegProc) => {
          const entry = activeDownloads.get(bookId)
          if (entry) entry.ffmpegProcess = ffmpegProc
        },
        abortController.signal,
        exportFormat,
        { audibleFormat, voucher: audibleVoucher }
      )

      dbService.updateBookStatus(book.id, true, finalPath)
      dbService.addLog('success', 'Download Complete', `"${book.title}" has been successfully exported to your NAS.`)
      serverService?.broadcast('library:updated', { source: 'download', bookId: book.id })

      // 3. Trigger Azure scan if configured
      const azureConfig = getAzureConfig()
      if (azureConfig) {
        scheduleAzureScanAfterDownloads(azureConfig)
      }
    } catch (err: any) {
      if (isCancellationError(err)) {
        appLog('info', 'Download Cancelled', `"${book.title}" was cancelled.`)
        return { success: false, cancelled: true }
      }
      appLog('error', 'Download Failed', `"${book.title}" (${book.id}): ${formatError(err)}`)
      throw err
    } finally {
      activeDownloads.delete(bookId)
      progressBroadcastState.delete(bookId)
      maybeTriggerPendingAzureScan()
    }

    return { success: true, cancelled: false }
  })

  handleIpc('book:cancel-download', (_event, bookId: string) => {
    const entry = activeDownloads.get(bookId)
    if (entry) {
      entry.abortController.abort()
      if (entry.ffmpegProcess) entry.ffmpegProcess.kill()
      return { cancelled: true }
    }
    return { cancelled: false }
  })

  // --- Ignore/Hide ---
  handleIpc('book:toggle-ignore', (_event, bookId: string) => {
    const isIgnored = dbService.toggleIgnored(bookId)
    serverService?.broadcast('library:updated', { source: 'toggle-ignore', bookId, isIgnored })
    return isIgnored
  })

  // --- Settings ---
  handleIpc(
    'settings:get',
    (_event, key: string, defaultValue: string) => {
      return dbService.getSetting(key, defaultValue)
    }
  )

  handleIpc('settings:set', (_event, key: string, value: string) => {
    dbService.setSetting(key, value)
    return true
  })

  handleIpc('settings:restart-server', () => {
    if (serverService) serverService.restart()
    return true
  })

  handleIpc('settings:get-mobile-connection-info', () => {
    return getCompanionConnectionInfo()
  })

  handleIpc(
    'settings:test-azure',
    async (_event, url: string, username: string, password: string, libraryId: string) => {
      try {
        const libraryName = await azureTestConnection({ url, username, password, libraryId })
        // Clear any stale token cache so the next operation logs in with the
        // freshly-verified creds.
        dbService.setSetting('azureToken', '')
        return { success: true, libraryName }
      } catch (err: any) {
        const errorMsg = describeAzureError(err, 'test')
        return { success: false, error: errorMsg }
      }
    },
  )

  handleIpc(
    'settings:list-azure-libraries',
    async (_event, url: string, username: string, password: string) => {
      try {
        return { success: true, libraries: await azureListLibraries(url, username, password) }
      } catch (err: any) {
        return { success: false, error: describeAzureError(err, 'test') }
      }
    },
  )

  handleIpc('app:get-version', () => app.getVersion())

  // --- Logs ---
  handleIpc('log:get', (_event, limit: number) => {
    return dbService.getLogs(limit)
  })

  handleIpc('log:add', (_event, type: 'success' | 'error' | 'info', title: string, message: string) => {
    if (!shouldPersistClientLog(type)) return true
    dbService.addLog(type, title, message)
    return true
  })

  handleIpc('log:clear', () => {
    dbService.clearLogs()
    return true
  })

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (isNasScanWorker) {
  startNasScanWorker()
} else {
  app.whenReady().then(async () => {
    console.log(`[${new Date().toISOString()}] [INFO] App Startup Initializing services`)
    dbService = new DatabaseService()

    // Initialize Companion API Server
    serverService = new ServerService(dbService, {
      syncAudible: syncAudibleAction,
      scanNas: scanNasAction,
      scanAzure: scanAzureAction,
      getQueueSnapshot: () => companionQueueSnapshot,
      login: loginAction,
      deleteAccount: async (id: string) => {
        dbService.deleteAccount(id)
      },
      downloadBook: async (id: string) => {
        console.log(`[Main] downloadBook triggered via API for id: ${id}`);
        if (!mainWindow) {
          console.error('[Main] downloadBook FAILED: mainWindow is null');
          throw new Error('Main window not available.');
        }
        // Trigger IPC-like download logic
        mainWindow.webContents.send('book:download-remote', id)
        return { queued: true }
      },
      downloadMany: async (ids: string[]) => {
        console.log(`[Main] downloadMany triggered via API for ${ids.length} ids`);
        if (!mainWindow) {
          console.error('[Main] downloadMany FAILED: mainWindow is null');
          throw new Error('Main window not available.');
        }
        if (mainWindow.isDestroyed()) {
          console.error('[Main] downloadMany FAILED: mainWindow is destroyed');
          throw new Error('Main window has been closed.');
        }
        console.log('[Main] Sending book:download-many-remote to renderer');
        mainWindow.webContents.send('book:download-many-remote', ids)
        return { queued: true, count: ids.length }
      },
      cancelDownload: (id: string) => {
        console.log(`[Main] cancelDownload triggered via API for id: ${id}`);
        const entry = activeDownloads.get(id)
        if (entry) {
          entry.abortController.abort()
          if (entry.ffmpegProcess) entry.ffmpegProcess.kill()
          return true
        }
        return false
      },
      toggleIgnore: (id: string) => {
        return dbService.toggleIgnored(id)
      }
    }, () => {
      // Notify the renderer whenever the companion API mutates library data
      mainWindow?.webContents.send('library:remote-changed')
    })
    serverService.start()

    // Multi-account support initialized. Accounts are loaded from the database.
    appLog('success', 'App Startup', 'Initialization complete')

    createWindow()
    createTray()

    app.on('activate', () => {
      appLog('info', 'App Lifecycle', 'Activate event received')
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else showMainWindow()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('window-all-closed', () => {
    appLog('info', 'App Lifecycle', 'All windows closed')
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

let azureScanTimer: ReturnType<typeof setTimeout> | null = null
const AZURE_SCAN_DEBOUNCE_MS = 5000

function scheduleAzureScanAfterDownloads(config: AzureConfig) {
  pendingAzureScanConfig = config
  maybeTriggerPendingAzureScan()
}

function maybeTriggerPendingAzureScan() {
  if (!pendingAzureScanConfig) return
  if (activeDownloads.size > 0) {
    appLog('info', 'Azure Scan', `Deferring Azure scan until all downloads finish (${activeDownloads.size} active)`, undefined, 'verbose')
    return
  }

  const config = pendingAzureScanConfig
  pendingAzureScanConfig = null
  debouncedAzureScan(config)
}

type ScanWorkerStartMessage = {
  type: 'start'
  nasPath: string
  books: Book[]
}

function isScanWorkerStartMessage(value: unknown): value is ScanWorkerStartMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return candidate.type === 'start' && typeof candidate.nasPath === 'string' && Array.isArray(candidate.books)
}

function startNasScanWorker() {
  if (typeof process.send !== 'function') {
    throw new Error('NAS scan worker requires an IPC channel.')
  }

  process.once('message', async (message) => {
    if (!isScanWorkerStartMessage(message)) {
      process.send?.({ type: 'error', message: 'Invalid NAS scan worker payload.' })
      process.exit(1)
      return
    }

    try {
      const found = await scanAndMatchCore(message.nasPath, message.books, (progress) => {
        process.send?.({ type: 'progress', ...progress })
      })
      process.send?.({ type: 'result', found })
      process.exit(0)
    } catch (err) {
      process.send?.({ type: 'error', message: formatError(err) })
      process.exit(1)
    }
  })
}

function debouncedAzureScan(config: AzureConfig) {
  if (azureScanTimer) clearTimeout(azureScanTimer)
  azureScanTimer = setTimeout(() => {
    azureScanTimer = null
    runAzureScanTrigger(config).catch((err) => {
      console.error('Failed to trigger Azure scan:', err)
    })
  }, AZURE_SCAN_DEBOUNCE_MS)
}

/**
 * Asks the Azure server to rescan its library so any newly-dropped files are
 * picked up. POST /api/admin/libraries/:id/scan
 */
async function runAzureScanTrigger(config: AzureConfig) {
  try {
    appLog('info', 'Azure Scan', `Triggering library scan for ${config.libraryId} at ${config.url}`)
    await azureTriggerScan(dbService, config)
    appLog('success', 'Azure Scan', `Triggered library scan for ${config.libraryId}`)
  } catch (err: any) {
    const errorMsg = describeAzureError(err, 'trigger')
    const fullMsg = `Azure scan trigger failed: ${errorMsg}`
    appLog('error', 'Azure Scan', fullMsg)
    throw new Error(fullMsg)
  }
}
