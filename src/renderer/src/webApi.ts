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

function waitForAudibleRedirect(oauthUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = '99999'
    overlay.style.background = 'rgba(2, 6, 23, 0.82)'
    overlay.style.backdropFilter = 'blur(8px)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.padding = '24px'

    const panel = document.createElement('div')
    panel.style.width = 'min(560px, 100%)'
    panel.style.background = '#0f172a'
    panel.style.border = '1px solid rgba(148, 163, 184, 0.25)'
    panel.style.borderRadius = '16px'
    panel.style.boxShadow = '0 24px 80px rgba(0, 0, 0, 0.45)'
    panel.style.padding = '24px'
    panel.style.color = '#e2e8f0'
    panel.style.fontFamily = 'Inter, ui-sans-serif, system-ui, sans-serif'

    const title = document.createElement('h2')
    title.textContent = 'Finish Audible Login'
    title.style.margin = '0 0 10px'
    title.style.fontSize = '22px'
    title.style.fontWeight = '800'

    const body = document.createElement('p')
    body.textContent = 'Complete the Audible sign-in tab, copy the final page URL from the browser address bar, then paste it here.'
    body.style.margin = '0 0 18px'
    body.style.color = '#94a3b8'
    body.style.lineHeight = '1.5'

    const loginLink = document.createElement('a')
    loginLink.href = oauthUrl
    loginLink.target = '_blank'
    loginLink.rel = 'noopener noreferrer'
    loginLink.textContent = 'Open Audible login'
    loginLink.style.display = 'inline-flex'
    loginLink.style.marginBottom = '16px'
    loginLink.style.color = '#f59e0b'
    loginLink.style.fontWeight = '700'

    const input = document.createElement('textarea')
    input.placeholder = 'Paste the final Audible/Amazon URL here'
    input.rows = 4
    input.style.width = '100%'
    input.style.boxSizing = 'border-box'
    input.style.resize = 'vertical'
    input.style.border = '1px solid rgba(148, 163, 184, 0.3)'
    input.style.borderRadius = '12px'
    input.style.background = '#020617'
    input.style.color = '#e2e8f0'
    input.style.padding = '12px'
    input.style.outline = 'none'

    const error = document.createElement('div')
    error.style.minHeight = '22px'
    error.style.marginTop = '8px'
    error.style.color = '#f87171'
    error.style.fontSize = '13px'

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.justifyContent = 'flex-end'
    actions.style.gap = '10px'
    actions.style.marginTop = '16px'

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancel'
    cancel.style.border = '1px solid rgba(148, 163, 184, 0.3)'
    cancel.style.borderRadius = '10px'
    cancel.style.background = 'transparent'
    cancel.style.color = '#cbd5e1'
    cancel.style.padding = '10px 14px'
    cancel.style.cursor = 'pointer'

    const submit = document.createElement('button')
    submit.type = 'button'
    submit.textContent = 'Connect Account'
    submit.style.border = '0'
    submit.style.borderRadius = '10px'
    submit.style.background = '#f59e0b'
    submit.style.color = '#020617'
    submit.style.padding = '10px 14px'
    submit.style.fontWeight = '800'
    submit.style.cursor = 'pointer'

    const cleanup = (value: string | null) => {
      overlay.remove()
      resolve(value)
    }

    submit.onclick = () => {
      const value = input.value.trim()
      if (!value) {
        error.textContent = 'Paste the final URL before connecting.'
        return
      }
      if (!value.includes('openid.oa2.authorization_code=')) {
        error.textContent = 'That URL does not contain the Audible authorization code yet.'
        return
      }
      cleanup(value)
    }
    cancel.onclick = () => cleanup(null)

    actions.append(cancel, submit)
    panel.append(title, body, loginLink, input, error, actions)
    overlay.append(panel)
    document.body.append(overlay)
    input.focus()
  })
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
      if (message.type === 'library:updated') emit('library:remote-changed', message.data)
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
  const responseUrl = await waitForAudibleRedirect(loginStart.oauth_url)
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
      onDownloadFailed: (callback) => on('book:download-failed', callback),
      onDownloadRemote: (callback) => on('book:download-remote', callback),
      onDownloadManyRemote: (callback) => on('book:download-many-remote', callback),
    },
    settings: {
      get: (key: string, defaultValue: string) => rpc('settings:get', key, defaultValue),
      set: (key: string, value: string) => rpc('settings:set', key, value),
      testAzure: (url: string, username: string, password: string, libraryId: string) =>
        rpc('settings:test-azure', url, username, password, libraryId),
      listAzureLibraries: (url: string, username: string, password: string) =>
        rpc('settings:list-azure-libraries', url, username, password),
      restartServer: () => rpc('settings:restart-server'),
      getMobileConnectionInfo: () => rpc('settings:get-mobile-connection-info'),
    },
    logs: {
      get: (limit?: number) => rpc('log:get', limit),
      add: (type, title, message) => rpc('log:add', type, title, message),
      clear: () => rpc('log:clear'),
      onActivity: (callback) => on('log:activity', callback),
    },
  } satisfies IElectronAPI
}
