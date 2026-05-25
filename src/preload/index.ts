import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },
  auth: {
    login: (region: string) => ipcRenderer.invoke('auth:login', region),
    logout: () => ipcRenderer.invoke('auth:logout'),
    checkSession: () => ipcRenderer.invoke('auth:check-session')
  },
  account: {
    list: () => ipcRenderer.invoke('account:list'),
    delete: (accountId: string) => ipcRenderer.invoke('account:delete', accountId)
  },
  library: {
    sync: () => ipcRenderer.invoke('library:sync'),
    get: () => ipcRenderer.invoke('library:get'),
    getAllDetails: () => ipcRenderer.invoke('library:get-all-details'),
    scanNas: () => ipcRenderer.invoke('library:scan-nas'),
    scanAzure: () => ipcRenderer.invoke('library:scan-azure'),
    updateQueueSnapshot: (snapshot: { queuePaused: boolean; items: Array<{ bookId: string; status: 'queued' | 'downloading' | 'converting'; progress: number; phase?: 'download' | 'convert'; addedAt: number }> }) =>
      ipcRenderer.invoke('library:update-queue-snapshot', snapshot),
    onSyncProgress: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('library:sync-progress', listener)
      return () => ipcRenderer.removeListener('library:sync-progress', listener)
    },
    onScanProgress: (callback: (data: { current: number; total: number; filename: string }) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('library:scan-progress', listener)
      return () => ipcRenderer.removeListener('library:scan-progress', listener)
    },
    onEnrichProgress: (callback: (data: { completed: number; total: number; bookId: string; details: any }) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('library:enrich-progress', listener)
      return () => ipcRenderer.removeListener('library:enrich-progress', listener)
    },
    onEnrichComplete: (callback: (data: { total: number }) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('library:enrich-complete', listener)
      return () => ipcRenderer.removeListener('library:enrich-complete', listener)
    },
    onRemoteChanged: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('library:remote-changed', listener)
      return () => ipcRenderer.removeListener('library:remote-changed', listener)
    }
  },
  book: {
    download: (bookId: string) => ipcRenderer.invoke('book:download', bookId),
    rescan: (bookId: string) => ipcRenderer.invoke('book:rescan', bookId),
    rescanMany: (bookIds: string[]) => ipcRenderer.invoke('book:rescan-many', bookIds),
    cancelDownload: (bookId: string) => ipcRenderer.invoke('book:cancel-download', bookId),
    getDetails: (bookId: string) => ipcRenderer.invoke('book:details', bookId),
    toggleIgnore: (bookId: string) => ipcRenderer.invoke('book:toggle-ignore', bookId),
    onDownloadProgress: (callback: (data: { bookId: string; progress: number; speed?: number; phase: string }) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('book:download-progress', listener)
      return () => ipcRenderer.removeListener('book:download-progress', listener)
    },
    onDownloadRemote: (callback: (bookId: string) => void) => {
      const listener = (_event: any, bookId: string) => callback(bookId)
      ipcRenderer.on('book:download-remote', listener)
      return () => ipcRenderer.removeListener('book:download-remote', listener)
    },
    onDownloadManyRemote: (callback: (bookIds: string[]) => void) => {
      const listener = (_event: any, bookIds: string[]) => callback(bookIds)
      ipcRenderer.on('book:download-many-remote', listener)
      return () => ipcRenderer.removeListener('book:download-many-remote', listener)
    }
  },
  settings: {
    get: (key: string, defaultValue: string) =>
      ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: string) =>
      ipcRenderer.invoke('settings:set', key, value),
    testAzure: (url: string, username: string, password: string, libraryId: string) =>
      ipcRenderer.invoke('settings:test-azure', url, username, password, libraryId),
    restartServer: () => ipcRenderer.invoke('settings:restart-server'),
    getMobileConnectionInfo: () => ipcRenderer.invoke('settings:get-mobile-connection-info')
  },
  logs: {
    get: (limit?: number) => ipcRenderer.invoke('log:get', limit),
    add: (type: 'success' | 'error' | 'info', title: string, message: string) =>
      ipcRenderer.invoke('log:add', type, title, message),
    clear: () => ipcRenderer.invoke('log:clear')
  }
})
