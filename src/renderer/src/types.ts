export type { Book, BookDetails } from '../../shared/schemas'

export interface Notification {
  id: string
  title: string
  description: string
  type: 'success' | 'error' | 'info'
  timestamp: Date
}

export type LogLevel = 'error' | 'standard' | 'verbose'
export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

export interface Account {
  id: string
  name: string
  region: string
  last_sync: string | null
}

export type QueueItemStatus = 'queued' | 'downloading' | 'converting' | 'completed' | 'failed' | 'cancelled'

export interface QueueItem {
  bookId: string
  status: QueueItemStatus
  progress: number
  speed?: number
  error?: string
  addedAt: number
}

export const SORT_OPTIONS = [
  { value: 'purchaseDate', label: 'Purchase Date' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'series', label: 'Series' },
  { value: 'narrator', label: 'Narrator' },
  { value: 'duration', label: 'Duration' },
] as const

export type SortField = (typeof SORT_OPTIONS)[number]['value']
