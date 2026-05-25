import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { sanitize } from './utils'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024 * 1024 // 20 GB

const parseSizeEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Disk cache for raw Audible AAX/AAXC downloads. Keyed by book ASIN. Lets the
 * conversion pipeline skip the multi-minute Audible download when a fresh copy
 * is already on disk — invaluable when iterating on tagging or recovering from
 * a botched conversion (silent file, wrong activation bytes, etc.).
 *
 * Eviction is LRU by mtime, capped at AAX_CACHE_MAX_BYTES (default 20 GB) and
 * with a hard TTL of AAX_CACHE_TTL_MS (default 7 days). Both are env-tunable.
 */
export class AaxCache {
  private readonly cacheDir: string
  private readonly ttlMs: number
  private readonly maxBytes: number

  constructor(rootDir: string) {
    this.cacheDir = process.env.AAX_CACHE_PATH || path.join(rootDir, 'aax-cache')
    this.ttlMs = parseSizeEnv(process.env.AAX_CACHE_TTL_MS, DEFAULT_TTL_MS)
    this.maxBytes = parseSizeEnv(process.env.AAX_CACHE_MAX_BYTES, DEFAULT_MAX_BYTES)
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    } catch {
      // If we can't create it, get() will return null and put() will throw —
      // both safe; the caller falls back to the regular download flow.
    }
  }

  private pathFor(bookId: string, ext: string): string {
    return path.join(this.cacheDir, `${sanitize(bookId)}.${ext}`)
  }

  /**
   * Return the cached path for a book if a fresh copy exists, else null. Touch
   * mtime on hit so LRU treats it as recently used.
   */
  async get(bookId: string, ext: 'aax' | 'aaxc' = 'aax'): Promise<string | null> {
    const p = this.pathFor(bookId, ext)
    let stat
    try {
      stat = await fsp.stat(p)
    } catch {
      return null
    }
    if (stat.size === 0) {
      await fsp.unlink(p).catch(() => {})
      return null
    }
    const ageMs = Date.now() - stat.mtimeMs
    if (ageMs > this.ttlMs) {
      await fsp.unlink(p).catch(() => {})
      return null
    }
    await fsp.utimes(p, new Date(), new Date()).catch(() => {})
    return p
  }

  /**
   * Move `sourcePath` into the cache, replacing any existing entry. Triggers
   * an LRU prune if we're over the size cap. Returns the final path.
   */
  async put(bookId: string, sourcePath: string, ext: 'aax' | 'aaxc' = 'aax'): Promise<string> {
    const target = this.pathFor(bookId, ext)
    try {
      await fsp.rename(sourcePath, target)
    } catch (err: any) {
      if (err?.code !== 'EXDEV') throw err
      // Source and cache are on different volumes — fall back to copy+unlink.
      await fsp.copyFile(sourcePath, target)
      await fsp.unlink(sourcePath).catch(() => {})
    }
    void this.prune().catch(() => {})
    return target
  }

  async remove(bookId: string, ext: 'aax' | 'aaxc' = 'aax'): Promise<void> {
    await fsp.unlink(this.pathFor(bookId, ext)).catch(() => {})
  }

  /** Drop everything in the cache. */
  async clear(): Promise<void> {
    const entries = await fsp.readdir(this.cacheDir).catch(() => [])
    await Promise.all(
      entries.map((name) => fsp.unlink(path.join(this.cacheDir, name)).catch(() => {})),
    )
  }

  /** Return current cache size (bytes) and entry count. */
  async stats(): Promise<{ bytes: number; entries: number }> {
    const entries = await fsp.readdir(this.cacheDir).catch(() => [])
    let bytes = 0
    let count = 0
    for (const name of entries) {
      try {
        const st = await fsp.stat(path.join(this.cacheDir, name))
        bytes += st.size
        count++
      } catch {
        // ignore
      }
    }
    return { bytes, entries: count }
  }

  /** LRU prune: evict oldest entries until total size is under the cap. */
  private async prune(): Promise<void> {
    const entries = await fsp.readdir(this.cacheDir).catch(() => [])
    const meta = await Promise.all(
      entries.map(async (name) => {
        const fullPath = path.join(this.cacheDir, name)
        try {
          const st = await fsp.stat(fullPath)
          return { path: fullPath, size: st.size, mtimeMs: st.mtimeMs }
        } catch {
          return null
        }
      }),
    )
    const valid = meta.filter((m): m is { path: string; size: number; mtimeMs: number } => m !== null)

    // Also drop anything past the TTL while we're walking.
    const now = Date.now()
    for (let i = valid.length - 1; i >= 0; i--) {
      if (now - valid[i].mtimeMs > this.ttlMs) {
        await fsp.unlink(valid[i].path).catch(() => {})
        valid.splice(i, 1)
      }
    }

    let total = valid.reduce((s, e) => s + e.size, 0)
    if (total <= this.maxBytes) return

    valid.sort((a, b) => a.mtimeMs - b.mtimeMs)
    for (const entry of valid) {
      if (total <= this.maxBytes) break
      await fsp.unlink(entry.path).catch(() => {})
      total -= entry.size
    }
  }
}
