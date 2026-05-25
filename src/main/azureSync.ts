import axios, { AxiosError } from 'axios'
import { DatabaseService } from './DatabaseService'
import { AbsLibraryItem } from './absSync'

// Azure server returns books shaped roughly like this. We translate them into
// the existing AbsLibraryItem shape so the matcher in absSync.ts stays
// untouched.
type AzureBookRecord = {
  id?: string
  asin?: string | null
  title?: string
  subtitle?: string | null
  author?: { name?: string | null } | null
  authorName?: string | null
  narrator?: string | null
  folderPath?: string | null
}

type AzureLibraryListResponse = {
  results?: AzureBookRecord[]
  total?: number
} | AzureBookRecord[]

export type AzureConfig = {
  url: string
  username: string
  password: string
  libraryId: string
}

const stripTrailingSlash = (s: string) => s.replace(/\+$/, '').replace(/\/+$/, '')

const isAxiosError = (err: unknown): err is AxiosError =>
  Boolean(err && typeof err === 'object' && (err as AxiosError).isAxiosError)

/** Translate an Azure book record into the shape the ABS matcher expects. */
export const azureBookToAbsItem = (book: AzureBookRecord): AbsLibraryItem => ({
  relPath: book.folderPath ?? undefined,
  media: {
    metadata: {
      asin: book.asin ?? undefined,
      title: book.title,
      subtitle: book.subtitle ?? undefined,
      authorName: book.author?.name ?? book.authorName ?? undefined,
    },
  },
})

/**
 * Logs into the Azure server. Returns a JWT good for ~7 days.
 * Throws a descriptive error on auth failure.
 */
export const azureLogin = async (url: string, username: string, password: string): Promise<string> => {
  const baseUrl = stripTrailingSlash(url)
  const res = await axios.post(
    `${baseUrl}/api/auth/login`,
    { username, password },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
  )
  const token = res.data?.token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Azure login succeeded but no token was returned.')
  }
  return token
}

/** Try a JWT; if it's stale/missing, log in fresh and persist the new one. */
const ensureAzureToken = async (dbService: DatabaseService, config: AzureConfig): Promise<string> => {
  const cached = dbService.getSetting('azureToken', '')
  if (cached) return cached
  const token = await azureLogin(config.url, config.username, config.password)
  dbService.setSetting('azureToken', token)
  return token
}

/**
 * Make a request to the Azure server, transparently refreshing the cached JWT
 * if it has expired. The callback is invoked with a current token; if it
 * throws a 401/403 the wrapper logs in again and retries exactly once.
 */
const withAzureAuth = async <T>(
  dbService: DatabaseService,
  config: AzureConfig,
  call: (token: string) => Promise<T>,
): Promise<T> => {
  let token = await ensureAzureToken(dbService, config)
  try {
    return await call(token)
  } catch (err) {
    if (!isAxiosError(err)) throw err
    const status = err.response?.status
    if (status !== 401 && status !== 403) throw err
    // Cached token rejected. Get a new one and retry once.
    token = await azureLogin(config.url, config.username, config.password)
    dbService.setSetting('azureToken', token)
    return await call(token)
  }
}

/**
 * Walk the Azure library, page by page, and collect every book.
 * Calls `onProgress` after each page so the UI can show "Fetching N/M".
 */
export const azureFetchLibraryItems = async (
  dbService: DatabaseService,
  config: AzureConfig,
  onProgress?: (current: number, total: number) => void,
): Promise<AbsLibraryItem[]> => {
  const baseUrl = stripTrailingSlash(config.url)
  const pageSize = 100
  const collected: AbsLibraryItem[] = []
  let page = 0
  let total = 0

  do {
    const data = await withAzureAuth(dbService, config, async (token) => {
      const res = await axios.get<AzureLibraryListResponse>(`${baseUrl}/api/library`, {
        params: {
          libraryId: config.libraryId,
          page,
          limit: pageSize,
        },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      })
      return res.data
    })

    const results = Array.isArray(data) ? data : (data.results ?? [])
    const reportedTotal = Array.isArray(data) ? results.length : (data.total ?? results.length)
    total = reportedTotal

    for (const book of results) {
      collected.push(azureBookToAbsItem(book))
    }

    onProgress?.(collected.length, total)

    // If the response was an unpaginated flat array, we have everything; stop.
    if (Array.isArray(data)) break
    if (results.length < pageSize) break
    page++
  } while (collected.length < total)

  return collected
}

/** POST a library scan request to the Azure admin endpoint. */
export const azureTriggerScan = async (
  dbService: DatabaseService,
  config: AzureConfig,
): Promise<void> => {
  const baseUrl = stripTrailingSlash(config.url)
  await withAzureAuth(dbService, config, async (token) => {
    await axios.post(
      `${baseUrl}/api/admin/libraries/${encodeURIComponent(config.libraryId)}/scan`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
    )
  })
}

/**
 * Ask Azure to rescan a specific folder rather than the entire library.
 * `relativePath` is the folder path relative to BookSync's NAS root —
 * Azure resolves it against its library's first enabled source. Falls
 * back to the full-library trigger if the folder-scan endpoint isn't
 * present on the server (older Azure deployments).
 */
export const azureTriggerFolderScan = async (
  dbService: DatabaseService,
  config: AzureConfig,
  relativePath: string,
): Promise<void> => {
  const baseUrl = stripTrailingSlash(config.url)
  await withAzureAuth(dbService, config, async (token) => {
    try {
      await axios.post(
        `${baseUrl}/api/admin/libraries/${encodeURIComponent(config.libraryId)}/scan-folder`,
        { relativePath, trigger: 'booksync' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
      )
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        // Older Azure server without the folder-scan endpoint — fall back.
        await axios.post(
          `${baseUrl}/api/admin/libraries/${encodeURIComponent(config.libraryId)}/scan`,
          {},
          { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
        )
        return
      }
      throw err
    }
  })
}

/**
 * Verifies that the configured Azure server is reachable, the credentials
 * work, and the configured libraryId exists. Returns the library name on
 * success.
 */
export const azureTestConnection = async (config: AzureConfig): Promise<string> => {
  const baseUrl = stripTrailingSlash(config.url)
  const token = await azureLogin(config.url, config.username, config.password)
  const res = await axios.get(`${baseUrl}/api/library/libraries`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  })
  const libraries: Array<{ id: string; name: string }> = Array.isArray(res.data)
    ? res.data
    : (res.data?.libraries ?? [])
  const match = libraries.find((lib) => lib.id === config.libraryId)
  if (!match) {
    throw new Error(`Login succeeded but library "${config.libraryId}" was not found on the server.`)
  }
  return match.name
}

export const azureListLibraries = async (
  url: string,
  username: string,
  password: string,
): Promise<Array<{ id: string; name: string; description?: string | null; books?: number; sources?: number }>> => {
  const baseUrl = stripTrailingSlash(url)
  const token = await azureLogin(url, username, password)
  const res = await axios.get(`${baseUrl}/api/library/libraries`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  })
  const libraries: any[] = Array.isArray(res.data)
    ? res.data
    : (res.data?.libraries ?? [])

  return libraries.map((library) => ({
    id: String(library.id),
    name: String(library.name ?? 'Unnamed Library'),
    description: library.description ?? null,
    books: typeof library._count?.books === 'number' ? library._count.books : undefined,
    sources: typeof library._count?.sources === 'number' ? library._count.sources : undefined,
  }))
}

/** Turn an axios/Azure error into a user-readable string. */
export const describeAzureError = (err: unknown, context: string): string => {
  if (!isAxiosError(err)) {
    const fallback = err instanceof Error ? err.message : String(err)
    return fallback || `Azure ${context} failed with an unknown error.`
  }

  const status = err.response?.status
  const upstream = (err.response?.data as { error?: string; message?: string } | undefined)
  const upstreamMessage = upstream?.error || upstream?.message || err.message

  if (status === 401 || status === 403) {
    return `Azure rejected the credentials during ${context}. Re-check the username and password.`
  }
  if (status === 404) {
    return `Azure endpoint not found during ${context}. Verify the server URL and library ID.`
  }
  if (status === 502 || status === 503 || status === 504) {
    return `Azure returned ${status} during ${context}. The server may be down or restarting.`
  }
  return upstreamMessage || `Azure ${context} failed with status ${status ?? 'unknown'}.`
}
