import path from 'path'
import { fork } from 'child_process'
import type { Book } from './types'
import { scanAndMatchCore, type ScanProgress } from './scanCore'

type ScanWorkerMessage =
  | ({ type: 'progress' } & ScanProgress)
  | { type: 'result'; found: Array<{ id: string; path: string }> }
  | { type: 'error'; message: string }

export class ScanService {
  private readonly workerPath = path.join(__dirname, 'index.js')

  async scanAndMatch(
    nasPath: string,
    books: Book[],
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<Array<{ id: string; path: string }>> {
    try {
      return await this.scanAndMatchInWorker(nasPath, books, onProgress)
    } catch {
      return scanAndMatchCore(nasPath, books, (progress) => {
        onProgress?.(progress.current, progress.total, progress.filename)
      })
    }
  }

  private scanAndMatchInWorker(
    nasPath: string,
    books: Book[],
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<Array<{ id: string; path: string }>> {
    return new Promise((resolve, reject) => {
      const worker = fork(this.workerPath, [], {
        env: { ...process.env, BOOKSYNC_SCAN_WORKER: '1' },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc']
      })

      let settled = false
      const rejectOnce = (err: Error) => {
        if (settled) return
        settled = true
        reject(err)
      }

      worker.on('message', (message: ScanWorkerMessage) => {
        if (message.type === 'progress') {
          onProgress?.(message.current, message.total, message.filename)
          return
        }

        if (message.type === 'error') {
          rejectOnce(new Error(message.message || 'NAS scan worker failed.'))
          return
        }

        settled = true
        resolve(message.found)
      })

      worker.send({ type: 'start', nasPath, books })
      worker.on('error', (err) => rejectOnce(err))
      worker.on('exit', (code) => {
        if (settled) return
        if (code !== 0) {
          rejectOnce(new Error(`NAS scan worker exited with code ${code}.`))
        }
      })
    })
  }
}
