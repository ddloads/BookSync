import type { IElectronAPI } from './env'

type Listener = (data: any) => void

const listeners = new Map<string, Set<Listener>>()

function emit(type: string, data: any) {
  listeners.get(type)?.forEach((listener) => listener(data))
}

function on(type: string, callback: Listener) {
  let set = listeners.get(type)
  if (!set) {
    set = new Set()
    listeners.set(type, set)
  }
  set.add(callback)
  return () => set?.delete(callback)
}

async function rpc<T>(channel: string, ...args: any[]): Promise<T> {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, args }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `Request failed: ${res.status}`)
  return payload.data as T
}

function connectEvents() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/events`)
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      emit(message.type, message.data)
      if (message.type === 'book:download-remote') emit('book:download-remote', message.data)
      if (message.type === 'book:download-many-remote') emit('book:download-many-remote', message.data)
      if (message.type === 'library:updated') emit('library:remote-changed', null)
    } catch {
      // Ignore malformed event frames.
    }
  }
  ws.onclose = () => setTimeout(connectEvents, 1500)
}

async function webLogin(region: string = 'us') {
  const startRes = await fetch('/api/auth/login-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region }),
  })
  const loginStart = await startRes.json()
  if (!startRes.ok) return { success: false, error: loginStart.error || 'Failed to start login.' }

  window.open(loginStart.oauth_url, '_blank', 'noopener,noreferrer')
  const responseUrl = window.prompt('Complete the Audible login in the opened tab, then paste the final redirected URL here.')
  if (!responseUrl) return { success: false, cancelled: true }

  const registerRes = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      responseUrl,
      serial: loginStart.serial,
      codeVerifier: loginStart.code_verifier,
      region,
    }),
  })
  const result = await registerRes.json()
  if (!registerRes.ok) return { success: false, error: result.error || 'Failed to finish login.' }
  return result
}

if (!window.api) {
  connectEvents()
  window.api = {
    app: {
      getVersion: () => rpc('app:get-version'),
    },
    auth: {
      login: webLogin,
      logout: () => rpc('auth:logout'),
      checkSession: () => rpc('auth:check-session'),
    },
    account: {
      list: () => rpc('account:list'),
      delete: (accountId: string) => rpc('account:delete', accountId),
    },
    library: {
      sync: () => rpc('library:sync'),
      get: () => rpc('library:get'),
      getAllDetails: () => rpc('library:get-all-details'),
      scanNas: () => rpc('library:scan-nas'),
      scanAzure: () => rpc('library:scan-azure'),
      updateQueueSnapshot: (snapshot) => rpc('library:update-queue-snapshot', snapshot),
      onSyncProgress: (callback) => on('library:sync-progress', callback),
      onScanProgress: (callback) => on('library:scan-progress', callback),
      onEnrichProgress: (callback) => on('library:enrich-progress', callback),
      onEnrichComplete: (callback) => on('library:enrich-complete', callback),
      onRemoteChanged: (callback) => on('library:remote-changed', callback),
    },
    book: {
      download: (bookId: string) => rpc('book:download', bookId),
      rescan: (bookId: string) => rpc('book:rescan', bookId),
      rescanMany: (bookIds: string[]) => rpc('book:rescan-many', bookIds),
      cancelDownload: (bookId: string) => rpc('book:cancel-download', bookId),
      getDetails: (bookId: string) => rpc('book:details', bookId),
      toggleIgnore: (bookId: string) => rpc('book:toggle-ignore', bookId),
      onDownloadProgress: (callback) => on('book:download-progress', callback),
      onDownloadRemote: (callback) => on('book:download-remote', callback),
      onDownloadManyRemote: (callback) => on('book:download-many-remote', callback),
    },
    settings: {
      get: (key: string, defaultValue: string) => rpc('settings:get', key, defaultValue),
      set: (key: string, value: string) => rpc('settings:set', key, value),
      testAzure: (url: string, username: string, password: string, libraryId: string) =>
        rpc('settings:test-azure', url, username, password, libraryId),
      restartServer: () => rpc('settings:restart-server'),
      getMobileConnectionInfo: () => rpc('settings:get-mobile-connection-info'),
    },
    logs: {
      get: (limit?: number) => rpc('log:get', limit),
      add: (type, title, message) => rpc('log:add', type, title, message),
      clear: () => rpc('log:clear'),
    },
  } satisfies IElectronAPI
}
