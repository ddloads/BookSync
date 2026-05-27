import express from 'express'
import path from 'path'
import os from 'os'
import fs from 'fs'
import axios from 'axios'
import { createServer } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import { spawn, type ChildProcess } from 'child_process'
import { DatabaseService } from '../main/DatabaseService'
import { AudibleService } from '../main/AudibleService'
import { ExportService } from '../main/ExportService'
import { ScanService } from '../main/ScanService'
import { AaxCache } from '../main/AaxCache'
import { AbsLibraryItem, decideAbsMatches } from '../main/absSync'
import {
  AzureConfig,
  azureFetchLibraryItems,
  azureFetchSilentBookAsins,
  azureListLibraries,
  azureTestConnection,
  azureTriggerScan,
  azureTriggerFolderScan,
  describeAzureError,
} from '../main/azureSync'
import type { Book } from '../main/types'
import { getAppPath, getAppVersion, getUserDataPath } from '../main/runtime'

const PORT = Number(process.env.PORT || 3000)
const ABS_RECENT_DOWNLOAD_GRACE_MS = 30 * 60 * 1000
const AZURE_SCAN_DEBOUNCE_MS = 5000
const DEFAULT_MOBILE_PUBLIC_URL = 'https://booksync.ddsplayground.com'

const audibleService = new AudibleService()
const dbService = new DatabaseService()
const aaxCache = new AaxCache(getUserDataPath())
const exportService = new ExportService(aaxCache)
const scanService = new ScanService()
const activeDownloads = new Map<string, { abortController: AbortController; ffmpegProcess: ChildProcess | null }>()
const progressBroadcastState = new Map<string, { lastProgress: number; lastTime: number; lastPhase: string }>()
let companionQueueSnapshot: {
  queuePaused: boolean
  items: Array<{ bookId: string; status: 'queued' | 'downloading' | 'converting'; progress: number; phase?: 'download' | 'convert'; addedAt: number }>
} = { queuePaused: false, items: [] }
let pendingAzureScanConfig: AzureConfig | null = null
let azureScanTimer: ReturnType<typeof setTimeout> | null = null
// Folders touched by completed downloads — we batch these so multiple
// downloads in the same folder collapse to one Azure folder-scan request.
const pendingAzureScanFolders = new Set<string>()

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/api/events' })

app.use(express.json({ limit: '2mb' }))

function getNasPath(): string {
  return dbService.getSetting('nasPath', '').trim() || '/downloads'
}

function getDownloadedAudioFile(bookId: string) {
  const book = dbService.getBooks().find((candidate) => candidate.id === bookId)
  if (!book || !book.isDownloaded || !book.nasPath) {
    return { error: 'Downloaded audio file not found for this title.' }
  }

  const filePath = path.resolve(book.nasPath)
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { error: 'Audio file is missing from the export path.', book, filePath }
  }

  return { book, filePath, stat: fs.statSync(filePath) }
}

function broadcast(type: string, data: any = null) {
  const message = JSON.stringify({ type, data })
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message)
  })
}

function appLog(type: 'success' | 'error' | 'info', title: string, message: string) {
  const prefix = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${title}`
  if (type === 'error') console.error(`${prefix} ${message}`)
  else console.log(`${prefix} ${message}`)
  try {
    dbService.addLog(type, title, message)
  } catch {
    // Logging should never break the API path.
  }
  if (type === 'error') {
    broadcast('log:activity', { type, title, message })
  }
}

function formatError(err: unknown): string {
  const e = err as any
  const msg = String(e?.message ?? e ?? 'Unknown error')
  const code = e?.code ? ` code=${String(e.code)}` : ''
  const status = e?.response?.status ? ` status=${String(e.response.status)}` : ''
  return `${msg}${code}${status}`
}

function isCancellationError(err: any): boolean {
  const msg = String(err?.message ?? '').toLowerCase()
  const code = String(err?.code ?? '')
  return msg.includes('canceled') || msg.includes('cancelled') || msg.includes('aborted') || msg.includes('abort') || code === 'ERR_CANCELED'
}

function shouldBroadcastProgress(bookId: string, progress: number, phase: string): boolean {
  const now = Date.now()
  const prev = progressBroadcastState.get(bookId)
  if (!prev || prev.lastPhase !== phase || Math.abs(progress - prev.lastProgress) >= 1 || now - prev.lastTime >= 500) {
    progressBroadcastState.set(bookId, { lastProgress: progress, lastTime: now, lastPhase: phase })
    return true
  }
  return false
}

function getAzureConfig(): AzureConfig | null {
  const url = dbService.getSetting('azureUrl', '')
  const username = dbService.getSetting('azureUsername', '')
  const password = dbService.getSetting('azurePassword', '')
  const libraryId = dbService.getSetting('azureLibraryId', '')
  if (!url || !username || !password || !libraryId) return null
  return { url, username, password, libraryId }
}

function getCompanionConnectionInfo() {
  const enabled = true
  const port = Number(process.env.PORT || dbService.getSetting('mobileServerPort', String(PORT)) || PORT)
  const publicUrl = (dbService.getSetting('mobileServerPublicUrl', DEFAULT_MOBILE_PUBLIC_URL).trim() || DEFAULT_MOBILE_PUBLIC_URL).replace(/\/+$/, '')
  const apiKey = ensureCompanionApiKey()
  const hosts = Object.values(os.networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address)
    .filter((value, index, array) => array.indexOf(value) === index)
  const primaryHost = hosts[0] ?? '127.0.0.1'
  const httpUrl = publicUrl || `http://${primaryHost}:${port}`
  const wsUrl = httpUrl.replace(/^http/, 'ws') + `?apiKey=${encodeURIComponent(apiKey)}`
  const qrParams = new URLSearchParams({ version: '2', apiKey, local: httpUrl })
  if (publicUrl) qrParams.set('public', publicUrl)
  return { enabled, port, publicUrl, apiKey, hosts, primaryHost, httpUrl, wsUrl, qrPayload: `booksync://connect?${qrParams.toString()}` }
}

function ensureCompanionApiKey(): string {
  let apiKey = dbService.getSetting('mobileServerApiKey', '')
  if (!apiKey) {
    apiKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    dbService.setSetting('mobileServerApiKey', apiKey)
  }
  return apiKey
}

async function syncAudibleAction() {
  const accounts = dbService.getAccounts()
  if (accounts.length === 0) throw new Error('No Audible accounts connected. Please add an account in Settings first.')

  let totalBooks = 0
  broadcast('library:sync-progress', {
    stage: 'starting',
    accountIndex: 0,
    accountTotal: accounts.length,
    totalBooks: 0,
    message: `Starting sync for ${accounts.length} account${accounts.length === 1 ? '' : 's'}`,
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
      message: `Syncing ${account.name} (${account.region})`,
    }
    broadcast('library:sync-progress', progressBase)

    try {
      const syncedItems = await audibleService.getLibrary(account.auth_data, (progress) => {
        broadcast('library:sync-progress', {
          stage: progress.stage === 'completed' ? 'account-complete' : 'account-progress',
          accountIndex: index + 1,
          accountTotal: accounts.length,
          accountName: account.name,
          accountRegion: account.region,
          page: progress.page,
          pageTotal: progress.pageTotal,
          itemsFetched: progress.itemsFetched,
          totalBooks,
          message: progress.message,
        })
      })
      const books = syncedItems.map((item) => item.book)
      dbService.saveBooks(books.map((book) => ({ ...book, accountId: account.id })))
      for (const item of syncedItems) {
        const hasSeedDetails =
          String(item.details?.description ?? '').trim() !== '' ||
          String(item.details?.releaseDate ?? '').trim() !== '' ||
          String(item.details?.seriesSequence ?? '').trim() !== ''
        if (hasSeedDetails) dbService.saveBookDetails(item.book.id, item.details)
      }
      dbService.updateAccountSyncTime(account.id)
      totalBooks += books.length
      broadcast('library:sync-progress', {
        stage: 'account-saved',
        accountIndex: index + 1,
        accountTotal: accounts.length,
        accountName: account.name,
        accountRegion: account.region,
        itemsFetched: books.length,
        totalBooks,
        message: `Saved ${books.length} titles from ${account.name}`,
      })
    } catch (err) {
      const errorData = {
        stage: 'account-error',
        accountIndex: index + 1,
        accountTotal: accounts.length,
        accountName: account.name,
        accountRegion: account.region,
        totalBooks,
        message: formatError(err),
      }
      broadcast('library:sync-progress', errorData)
      appLog('error', 'Audible Sync', `Failed to sync account ${account.name}: ${formatError(err)}`)
    }
  }

  broadcast('library:sync-progress', {
    stage: 'completed',
    accountIndex: accounts.length,
    accountTotal: accounts.length,
    totalBooks,
    message: `Retrieved ${totalBooks} titles from ${accounts.length} accounts`,
  })
  appLog('success', 'Audible Sync Complete', `Retrieved ${totalBooks} titles from ${accounts.length} accounts.`)
  broadcast('library:updated', { source: 'audible' })
  enrichLibrary().catch((err) => appLog('error', 'Metadata Enrichment', formatError(err)))
  return dbService.getBooks()
}

function hasCompleteBookDetails(details: any): boolean {
  if (!details) return false
  const description = String(details.description ?? '').trim()
  const releaseDate = String(details.releaseDate ?? '').trim()
  const publisher = String(details.publisher ?? '').trim()
  return description !== '' && description !== 'Metadata from Audible CLI' && releaseDate !== '' && publisher !== ''
}

async function enrichLibrary(): Promise<void> {
  const books = dbService.getBooks()
  const accountsById = new Map(dbService.getAccounts().map((account: any) => [account.id, account]))
  const unenriched = books.filter((book) => !hasCompleteBookDetails(dbService.getBookDetails(book.id)))
  if (unenriched.length === 0) return

  const total = unenriched.length
  let completed = 0
  for (let i = 0; i < unenriched.length; i += 3) {
    const batch = unenriched.slice(i, i + 3)
    const results = await Promise.all(batch.map(async (book) => {
      try {
        const account = book.accountId ? accountsById.get(book.accountId) as any : null
        if (!account) return { book, details: null }
        return { book, details: await audibleService.getBookDetails(account.auth_data, book.id) }
      } catch {
        return { book, details: null }
      }
    }))
    for (const { book, details } of results) {
      if (details) dbService.saveBookDetails(book.id, details)
      completed++
      broadcast('library:enrich-progress', { completed, total, bookId: book.id, details })
    }
    if (i + 3 < unenriched.length) await new Promise((resolve) => setTimeout(resolve, 400))
  }
  broadcast('library:enrich-complete', { total })
}

async function scanNasAction(onProgress?: (data: any) => void) {
  const nasPath = getNasPath()
  const books = dbService.getBooks()
  const foundResults = await scanService.scanAndMatch(nasPath, books, (current, total, filename) => {
    const progress = { current, total, filename, source: 'nas' }
    onProgress?.(progress)
    broadcast('library:scan-progress', progress)
  })
  dbService.updateBooksStatus(new Map(foundResults.map((result) => [result.id, result.path])))
  broadcast('library:updated', { source: 'nas' })
  return dbService.getBooks()
}

async function scanAzureAction() {
  const config = getAzureConfig()
  if (!config) throw new Error('Azure server not configured in Settings.')
  const azureItems = await azureFetchLibraryItems(dbService, config, (current, total) => {
    broadcast('library:scan-progress', { current, total: total || 1, filename: `Fetching items (${current}/${total})...`, source: 'azure' })
  })
  const allBooks = dbService.getBooks()
  const decision = decideAbsMatches(allBooks, azureItems as AbsLibraryItem[], { recentDownloadGraceMs: ABS_RECENT_DOWNLOAD_GRACE_MS })
  dbService.updateAbsStatus(decision.foundIds, decision.shouldResetUnmatched)

  try {
    const silentAsins = await azureFetchSilentBookAsins(dbService, config)
    dbService.updateAzureSilentStatus(silentAsins)
  } catch (err) {
    appLog('error', 'Azure Sync', `Silent-files fetch failed: ${describeAzureError(err, 'silent-files fetch')}`)
  }

  broadcast('library:updated', { source: 'azure' })
  return dbService.getBooks()
}

async function downloadBookAction(bookId: string) {
  const book = dbService.getBooks().find((candidate) => candidate.id === bookId)
  if (!book) throw new Error('Book not found in database.')
  const accountId = (book as any).accountId
  if (!accountId) throw new Error('No account associated with this book. Try syncing your library.')
  const account = dbService.getAccount(accountId)
  if (!account) throw new Error(`Account not found for this book (ID: ${accountId})`)
  const nasPath = getNasPath()
  if (activeDownloads.has(bookId)) {
    return { success: false, cancelled: false, error: 'Download already in progress' }
  }

  const abortController = new AbortController()
  activeDownloads.set(bookId, { abortController, ffmpegProcess: null })

  try {
    appLog('info', 'Download', `Fetching download URL and activation bytes for ${book.title}`)
    const [downloadUrlObj, activationBytes, details] = await Promise.all([
      audibleService.getDownloadUrl(account.auth_data, book.id),
      audibleService.getActivationBytes(account.auth_data),
      Promise.resolve(dbService.getBookDetails(book.id)).then((cached) =>
        cached ?? audibleService.getBookDetails(account.auth_data, book.id).catch(() => null),
      ),
    ])
    const downloadUrl = downloadUrlObj.download_url
    if (!downloadUrl) throw new Error('Failed to retrieve download URL from Audible.')
    const audibleVoucher = downloadUrlObj.voucher ? { key: String(downloadUrlObj.voucher.key), iv: String(downloadUrlObj.voucher.iv) } : null
    const audibleFormat = (downloadUrlObj.format === 'aaxc' ? 'aaxc' : 'aax') as 'aax' | 'aaxc'
    const exportFormat = dbService.getSetting('exportFormat', 'm4b') as 'm4b' | 'mp3'

    const finalPath = await exportService.downloadAndConvertStream(
      downloadUrl,
      book,
      details,
      nasPath,
      activationBytes,
      '',
      ({ progress, speed, phase }) => {
        const currentPhase = phase || 'download'
        const unifiedProgress = currentPhase === 'download' ? Math.round(progress * 0.9) : 90 + Math.round(progress * 0.1)
        const progressData = { bookId, progress: unifiedProgress, speed, phase: currentPhase, phaseProgress: progress }
        if (shouldBroadcastProgress(bookId, unifiedProgress, currentPhase)) {
          broadcast('book:download-progress', progressData)
          dbService.updateDownloadProgress(bookId, unifiedProgress, currentPhase)
        }
      },
      appLog,
      (ffmpegProc) => {
        const entry = activeDownloads.get(bookId)
        if (entry) entry.ffmpegProcess = ffmpegProc
      },
      abortController.signal,
      exportFormat,
      { audibleFormat, voucher: audibleVoucher },
    )

    dbService.updateBookStatus(book.id, true, finalPath)
    appLog('success', 'Download Complete', `"${book.title}" has been successfully exported to your NAS.`)
    broadcast('library:updated', { source: 'download', bookId: book.id })
    const azureConfig = getAzureConfig()
    if (azureConfig) {
      const relativeFolder = computeAzureRelativeFolder(finalPath)
      if (relativeFolder) pendingAzureScanFolders.add(relativeFolder)
      scheduleAzureScanAfterDownloads(azureConfig)
    }
  } catch (err: any) {
    if (isCancellationError(err)) {
      appLog('info', 'Download Cancelled', `"${book.title}" was cancelled.`)
      broadcast('book:download-failed', { bookId, cancelled: true })
      return { success: false, cancelled: true }
    }
    const message = formatError(err)
    appLog('error', 'Download Failed', `"${book.title}" (${book.id}): ${message}`)
    broadcast('book:download-failed', { bookId, error: message })
    throw err
  } finally {
    activeDownloads.delete(bookId)
    progressBroadcastState.delete(bookId)
    maybeTriggerPendingAzureScan()
  }
  return { success: true, cancelled: false }
}

function startDownloadBookAction(bookId: string) {
  const book = dbService.getBooks().find((candidate) => candidate.id === bookId)
  if (!book) throw new Error('Book not found in database.')
  if (activeDownloads.has(bookId)) {
    return { success: false, cancelled: false, error: 'Download already in progress' }
  }

  void downloadBookAction(bookId).catch(() => {
    // downloadBookAction already logs and broadcasts the failure.
  })

  return { success: true, cancelled: false, accepted: true }
}

async function rescanBook(bookId: string) {
  const nasPath = getNasPath()
  const book = dbService.getBooks().find((candidate) => candidate.id === bookId)
  if (!book) throw new Error('Book not found in database.')
  const found = (await scanService.scanAndMatch(nasPath, [book])).find((result) => result.id === book.id)
  dbService.updateBookStatus(book.id, Boolean(found), found?.path)
  broadcast('library:updated', { source: 'rescan', bookId: book.id, isDownloaded: Boolean(found) })
  return dbService.getBooks().find((candidate) => candidate.id === bookId)
}

async function rescanMany(bookIds: string[]) {
  const nasPath = getNasPath()
  const allBooks = dbService.getBooks()
  const books = bookIds.map((id) => allBooks.find((book) => book.id === id)).filter(Boolean) as Book[]
  const foundResults = await scanService.scanAndMatch(nasPath, books)
  for (const book of books) {
    const found = foundResults.find((result) => result.id === book.id)
    dbService.updateBookStatus(book.id, Boolean(found), found?.path)
    broadcast('library:updated', { source: 'rescan', bookId: book.id, isDownloaded: Boolean(found) })
  }
  const updatedBooks = dbService.getBooks()
  return bookIds.map((id) => updatedBooks.find((book) => book.id === id)).filter(Boolean)
}

function scheduleAzureScanAfterDownloads(config: AzureConfig) {
  pendingAzureScanConfig = config
  maybeTriggerPendingAzureScan()
}

function computeAzureRelativeFolder(absoluteFilePath: string): string | null {
  try {
    const nasRoot = getNasPath()
    if (!nasRoot || !absoluteFilePath) return null
    const folder = path.dirname(absoluteFilePath)
    const rel = path.relative(nasRoot, folder).replace(/\\/g, '/')
    if (!rel || rel.startsWith('..')) return null
    return rel
  } catch {
    return null
  }
}

function maybeTriggerPendingAzureScan() {
  if (!pendingAzureScanConfig || activeDownloads.size > 0) return
  const config = pendingAzureScanConfig
  pendingAzureScanConfig = null
  if (azureScanTimer) clearTimeout(azureScanTimer)
  azureScanTimer = setTimeout(() => {
    azureScanTimer = null
    const folders = Array.from(pendingAzureScanFolders)
    pendingAzureScanFolders.clear()

    if (folders.length === 0) {
      // No folder info captured — fall back to a library scan so we don't
      // silently drop a needed refresh on older code paths.
      azureTriggerScan(dbService, config).catch((err) => appLog('error', 'Azure Scan', describeAzureError(err, 'trigger')))
      return
    }

    for (const relativePath of folders) {
      azureTriggerFolderScan(dbService, config, relativePath).catch((err) =>
        appLog('error', 'Azure Scan', describeAzureError(err, `folder scan (${relativePath})`)),
      )
    }
  }, AZURE_SCAN_DEBOUNCE_MS)
}

const rpcHandlers: Record<string, (...args: any[]) => any> = {
  'app:get-version': () => getAppVersion(),
  'auth:logout': async () => {
    for (const account of dbService.getAccounts()) dbService.deleteAccount(account.id)
    return true
  },
  'auth:check-session': () => true,
  'account:list': () => dbService.getAccounts(),
  'account:delete': (accountId: string) => {
    dbService.deleteAccount(accountId)
    return true
  },
  'library:sync': syncAudibleAction,
  'library:get': () => dbService.getBooks(),
  'library:get-all-details': () => dbService.getAllBookDetails(),
  'library:scan-nas': scanNasAction,
  'library:scan-azure': scanAzureAction,
  'library:update-queue-snapshot': (snapshot: typeof companionQueueSnapshot) => {
    companionQueueSnapshot = {
      queuePaused: Boolean(snapshot?.queuePaused),
      items: Array.isArray(snapshot?.items) ? snapshot.items : [],
    }
    return true
  },
  'book:download': startDownloadBookAction,
  'book:rescan': rescanBook,
  'book:rescan-many': rescanMany,
  'book:cancel-download': (bookId: string) => {
    const entry = activeDownloads.get(bookId)
    if (!entry) return { cancelled: false }
    entry.abortController.abort()
    entry.ffmpegProcess?.kill()
    return { cancelled: true }
  },
  'book:details': async (bookId: string) => {
    const cached = dbService.getBookDetails(bookId)
    if (hasCompleteBookDetails(cached)) return cached
    const book = dbService.getBooks().find((candidate) => candidate.id === bookId)
    if (!book) throw new Error('Book not found in database.')
    const account = book.accountId ? dbService.getAccount(book.accountId) : null
    if (!account) throw new Error(`Account not found for this book (ID: ${book.accountId})`)
    const details = await audibleService.getBookDetails(account.auth_data, bookId)
    dbService.saveBookDetails(bookId, details)
    return details
  },
  'book:toggle-ignore': (bookId: string) => {
    const isIgnored = dbService.toggleIgnored(bookId)
    broadcast('library:updated', { source: 'toggle-ignore', bookId, isIgnored })
    return isIgnored
  },
  'settings:get': (key: string, defaultValue: string) => {
    const fallback = key === 'nasPath' ? '/downloads' : defaultValue
    const value = dbService.getSetting(key, fallback)
    return key === 'nasPath' && !value.trim() ? '/downloads' : value
  },
  'settings:set': (key: string, value: string) => {
    dbService.setSetting(key, value)
    return true
  },
  'settings:test-azure': async (url: string, username: string, password: string, libraryId: string) => {
    try {
      const libraryName = await azureTestConnection({ url, username, password, libraryId })
      dbService.setSetting('azureToken', '')
      return { success: true, libraryName }
    } catch (err) {
      return { success: false, error: describeAzureError(err, 'test') }
    }
  },
  'settings:list-azure-libraries': async (url: string, username: string, password: string) => {
    try {
      return { success: true, libraries: await azureListLibraries(url, username, password) }
    } catch (err) {
      return { success: false, error: describeAzureError(err, 'test') }
    }
  },
  'settings:restart-server': () => true,
  'settings:get-mobile-connection-info': getCompanionConnectionInfo,
  'log:get': (limit = 1000) => dbService.getLogs(limit),
  'log:add': (type: 'success' | 'error' | 'info', title: string, message: string) => {
    dbService.addLog(type, title, message)
    return true
  },
  'log:clear': () => {
    dbService.clearLogs()
    return true
  },
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: getAppVersion(), mode: 'web' })
})

app.get('/api/books/:id/audio', (req, res) => {
  const audio = getDownloadedAudioFile(req.params.id)
  if (audio.error || !audio.filePath || !audio.stat) {
    res.status(404).json({ error: audio.error })
    return
  }

  const { filePath, stat } = audio
  const ext = path.extname(filePath).toLowerCase()
  const contentType = ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4'
  const range = req.headers.range

  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', contentType)

  if (!range) {
    res.setHeader('Content-Length', stat.size)
    fs.createReadStream(filePath).pipe(res)
    return
  }

  const match = range.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    res.status(416).end()
    return
  }

  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : stat.size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || end >= stat.size || start > end) {
    res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
    return
  }

  res.status(206)
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
  res.setHeader('Content-Length', end - start + 1)
  fs.createReadStream(filePath, { start, end }).pipe(res)
})

function runVolumeDetect(filePath: string, startSec: number): Promise<{ startSec: number; meanDb: number | null; maxDb: number | null; ok: boolean; error?: string }> {
  const ffmpegPath = process.env.BOOKSYNC_FFMPEG_PATH || 'ffmpeg'
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, [
      '-hide_banner',
      '-nostats',
      '-ss', String(startSec),
      '-t', '10',
      '-i', filePath,
      '-vn',
      '-af', 'volumedetect',
      '-f', 'null',
      '-',
    ])
    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    proc.on('error', (err) => {
      resolve({ startSec, meanDb: null, maxDb: null, ok: false, error: err.message })
    })
    proc.on('close', (code) => {
      const meanMatch = stderr.match(/mean_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))\s*dB/)
      const maxMatch = stderr.match(/max_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))\s*dB/)
      const parseDb = (value?: string) => {
        if (!value || value === '-inf' || value === 'inf') return null
        return Number(value)
      }
      const meanDb = parseDb(meanMatch?.[1])
      const maxDb = parseDb(maxMatch?.[1])
      resolve({
        startSec,
        meanDb,
        maxDb,
        ok: code === 0 && maxDb !== null && maxDb > -60,
        error: code === 0 ? undefined : stderr.split(/\r?\n/).filter(Boolean).slice(-8).join('\n'),
      })
    })
  })
}

app.get('/api/books/:id/audio-diagnostics', async (req, res) => {
  const audio = getDownloadedAudioFile(req.params.id)
  if (audio.error || !audio.filePath || !audio.stat) {
    res.status(404).json({ error: audio.error, filePath: audio.filePath })
    return
  }

  const samples = await Promise.all([30, 300, 900].map((startSec) => runVolumeDetect(audio.filePath!, startSec)))
  res.json({
    filePath: audio.filePath,
    sizeBytes: audio.stat.size,
    modifiedAt: audio.stat.mtime.toISOString(),
    samples,
    likelyAudible: samples.some((sample) => sample.ok),
  })
})

app.post('/api/rpc', async (req, res) => {
  const { channel, args = [] } = req.body ?? {}
  const handler = rpcHandlers[channel]
  if (!handler) return res.status(404).json({ error: `Unknown RPC channel: ${channel}` })
  try {
    res.json({ data: await handler(...args) })
  } catch (err) {
    const message = formatError(err)
    if (channel !== 'book:download') {
      appLog('error', 'Action Failed', `${String(channel)}: ${message}`)
    }
    res.status(500).json({ error: message })
  }
})

app.post('/api/auth/login-url', async (req, res) => {
  try {
    res.json(await audibleService.getExternalLoginUrl(req.body?.region || 'us'))
  } catch (err) {
    res.status(500).json({ error: formatError(err) })
  }
})

app.post('/api/auth/register', async (req, res) => {
  const { responseUrl, serial, codeVerifier, region = 'us' } = req.body ?? {}
  if (!responseUrl || !serial || !codeVerifier) return res.status(400).json({ error: 'Missing login registration fields.' })
  try {
    const authObj = await audibleService.registerFromExternalLogin(responseUrl, serial, codeVerifier, region)
    const accountId = authObj.customer_info?.user_id || `acc_${Date.now()}`
    const accountName = authObj.customer_info?.name || `Account (${region})`
    dbService.saveAccount(accountId, accountName, region, JSON.stringify(authObj))
    res.json({ success: true, accountId })
  } catch (err) {
    res.status(500).json({ error: formatError(err) })
  }
})

const publicDir = path.resolve(__dirname, '..', 'public')
app.use(express.static(publicDir))
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BookSync web app listening on http://0.0.0.0:${PORT}`)
  console.log(`App path: ${getAppPath()}`)
  console.log(`Data path: ${getUserDataPath()}`)
})
