import path from 'path'

type ElectronModule = typeof import('electron')

function getElectron(): ElectronModule | null {
  try {
    // Keep Electron optional so the shared services can run under plain Node.
    const req = eval('require') as NodeRequire
    return req('electron') as ElectronModule
  } catch {
    return null
  }
}

export function getAppPath(): string {
  const electron = getElectron()
  return electron?.app?.getAppPath?.() ?? path.resolve(process.env.BOOKSYNC_APP_PATH || process.cwd())
}

export function getUserDataPath(): string {
  const configured = process.env.BOOKSYNC_DATA_DIR
  if (configured) return path.resolve(configured)

  const electron = getElectron()
  const electronPath = electron?.app?.getPath?.('userData')
  if (electronPath) return electronPath

  return path.resolve(process.cwd(), 'config')
}

export function isPackagedApp(): boolean {
  const electron = getElectron()
  return Boolean(electron?.app?.isPackaged)
}

export function getAppVersion(): string {
  const electron = getElectron()
  if (electron?.app?.getVersion) return electron.app.getVersion()
  return process.env.npm_package_version || '1.0.1'
}
