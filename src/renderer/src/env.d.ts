export interface IElectronAPI {
  app: {
    getVersion: () => Promise<string>
  }
  auth: {
    login: (region?: string) => Promise<{ success: boolean; accountId?: string; cancelled?: boolean; error?: string }>
    logout: () => Promise<boolean>
    checkSession: () => Promise<boolean>
  }
  account: {
    list: () => Promise<any[]>
    delete: (accountId: string) => Promise<boolean>
  }
  library: {
    sync: () => Promise<any[]>
    get: () => Promise<any[]>
    getAllDetails: () => Promise<Record<string, any>>
    scanNas: () => Promise<any[]>
    scanAzure: () => Promise<any[]>
    updateQueueSnapshot: (snapshot: {
      queuePaused: boolean
      items: Array<{
        bookId: string
        status: 'queued' | 'downloading' | 'converting'
        progress: number
        phase?: 'download' | 'convert'
        addedAt: number
      }>
    }) => Promise<boolean>
    onSyncProgress: (callback: (data: any) => void) => () => void
    onScanProgress: (callback: (data: { current: number; total: number; filename: string; source?: string }) => void) => () => void
    onEnrichProgress: (callback: (data: { completed: number; total: number; bookId: string; details: any }) => void) => () => void
    onEnrichComplete: (callback: (data: { total: number }) => void) => () => void
    onRemoteChanged: (callback: (data?: any) => void) => () => void
  }
  book: {
    download: (bookId: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string; accepted?: boolean }>
    rescan: (bookId: string) => Promise<any>
    rescanMany: (bookIds: string[]) => Promise<any[]>
    cancelDownload: (bookId: string) => Promise<{ cancelled: boolean }>
    getDetails: (bookId: string) => Promise<any>
    toggleIgnore: (bookId: string) => Promise<boolean>
    onDownloadProgress: (callback: (data: { bookId: string; progress: number; speed?: number; phase: 'download' | 'convert' }) => void) => () => void
    onDownloadFailed: (callback: (data: { bookId: string; error?: string; cancelled?: boolean }) => void) => () => void
    onDownloadRemote: (callback: (bookId: string) => void) => () => void
    onDownloadManyRemote: (callback: (bookIds: string[]) => void) => () => void
  }
  settings: {
    get: (key: string, defaultValue: string) => Promise<string>
    set: (key: string, value: string) => Promise<boolean>
    testAzure: (url: string, username: string, password: string, libraryId: string) => Promise<{ success: boolean; libraryName?: string; error?: string }>
    listAzureLibraries: (url: string, username: string, password: string) => Promise<{
      success: boolean
      libraries?: Array<{ id: string; name: string; description?: string | null; books?: number; sources?: number }>
      error?: string
    }>
    restartServer: () => Promise<boolean>
    getMobileConnectionInfo: () => Promise<{
      enabled: boolean
      port: number
      apiKey: string
      hosts: string[]
      primaryHost: string
      httpUrl: string
      wsUrl: string
      qrPayload: string
    }>
  }
  logs: {
    get: (limit?: number) => Promise<any[]>
    add: (type: 'success' | 'error' | 'info', title: string, message: string) => Promise<boolean>
    clear: () => Promise<boolean>
    onActivity: (callback: (data: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void) => () => void
  }
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
