import { Book, SortField } from './types'
import { normalizeContributorName } from '../../shared/index'

export function parseDurationToMinutes(duration?: string): number | null {
  if (!duration) return null
  const clockMatch = duration.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (clockMatch) {
    const hours = parseInt(clockMatch[1], 10)
    const minutes = parseInt(clockMatch[2], 10)
    const seconds = parseInt(clockMatch[3] ?? '0', 10)
    return hours * 60 + minutes + seconds / 60
  }
  const hMatch = duration.match(/(\d+)\s*hr/)
  const mMatch = duration.match(/(\d+)\s*min/)
  const sMatch = duration.match(/(\d+)\s*sec/)
  const hours = hMatch ? parseInt(hMatch[1]) : 0
  const minutes = mMatch ? parseInt(mMatch[1]) : 0
  const seconds = sMatch ? parseInt(sMatch[1]) : 0
  return hours * 60 + minutes + seconds / 60
}

export function formatDurationDisplay(duration?: string): string {
  if (!duration) return ''

  const clockMatch = duration.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (clockMatch) {
    const hours = parseInt(clockMatch[1], 10)
    const minutes = parseInt(clockMatch[2], 10)
    const seconds = parseInt(clockMatch[3] ?? '0', 10)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const totalMinutes = parseDurationToMinutes(duration)
  if (totalMinutes === null) return ''

  const totalSeconds = Math.round(totalMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Parses Audible release dates into an ISO date string.
// Handles ISO format ("2020-03-15"), full dates, and Audible's "MM-DD-YY" or "MM-DD-YYYY" formats.
export function parseAudibleDate(releaseDate: string): string | null {
  if (!releaseDate) return null

  // Try standard parsing first (covers ISO 8601, "Jan 15 2020", etc.)
  const direct = new Date(releaseDate)
  if (!isNaN(direct.getTime()) && direct.getFullYear() > 100) {
    return direct.toISOString()
  }

  // Fall back to Audible's "MM-DD-YY" or "MM-DD-YYYY" format
  const parts = releaseDate.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (!parts) return null
  const mm = parseInt(parts[1])
  const dd = parseInt(parts[2])
  const yearRaw = parseInt(parts[3])
  
  const year = yearRaw < 100 ? (yearRaw >= 30 ? 1900 + yearRaw : 2000 + yearRaw) : yearRaw
  const date = new Date(year, mm - 1, dd)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

export function sanitizePath(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_')
}

function compareDateValue(
  valA: string | null | undefined,
  valB: string | null | undefined,
  order: 'asc' | 'desc'
): number {
  if (!valA && !valB) return 0
  if (!valA) return 1
  if (!valB) return -1

  const timeA = new Date(valA).getTime()
  const timeB = new Date(valB).getTime()

  if (isNaN(timeA) && isNaN(timeB)) return 0
  if (isNaN(timeA)) return 1
  if (isNaN(timeB)) return -1

  if (timeA === timeB) return 0
  return order === 'asc' ? timeA - timeB : timeB - timeA
}

export function compareField(a: Book, b: Book, field: SortField, order: 'asc' | 'desc'): number {
  if (field === 'duration') {
    const durA = parseDurationToMinutes(a.duration)
    const durB = parseDurationToMinutes(b.duration)
    if (durA === durB) return 0
    if (durA === null) return 1
    if (durB === null) return -1
    return order === 'asc' ? durA - durB : durB - durA
  }
  if (field === 'purchaseDate') {
    return compareDateValue(a.purchaseDate, b.purchaseDate, order)
  }
  const rawA = a[field] as string | null | undefined
  const rawB = b[field] as string | null | undefined
  const valA = (field === 'author' || field === 'narrator' ? normalizeContributorName(rawA ?? '') : rawA ?? '').toLowerCase()
  const valB = (field === 'author' || field === 'narrator' ? normalizeContributorName(rawB ?? '') : rawB ?? '').toLowerCase()
  if (!rawA && !rawB) return 0
  if (!rawA) return 1
  if (!rawB) return -1
  const cmp = valA.localeCompare(valB)
  return order === 'asc' ? cmp : -cmp
}
