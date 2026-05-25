import { create } from 'zustand'
import { ExternalToast, toast } from 'sonner'
import { Notification } from '../types'

const NOTIFICATION_TTL_MS = 5000
const ERROR_DEDUPE_MS = 3000

interface NotificationState {
  notifications: Notification[]
  showNotifications: boolean
  addNotification: (title: string, description: string, type: Notification['type']) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  toggleShowNotifications: () => void
  hideNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  showNotifications: false,

  addNotification: (title, description, type) => {
    let shouldAdd = true
    const entry: Notification = {
      id: Math.random().toString(36).substring(7),
      title,
      description,
      type,
      timestamp: new Date()
    }
    set(state => {
      const duplicate = state.notifications.find(notification =>
        notification.type === type &&
        notification.title === title &&
        notification.description === description &&
        entry.timestamp.getTime() - notification.timestamp.getTime() < ERROR_DEDUPE_MS
      )
      shouldAdd = !duplicate
      return shouldAdd ? { notifications: [entry, ...state.notifications].slice(0, 50) } : state
    })

    if (shouldAdd && type !== 'error') {
      window.setTimeout(() => {
        set(state => ({ notifications: state.notifications.filter(notification => notification.id !== entry.id) }))
      }, NOTIFICATION_TTL_MS)
    }
  },

  removeNotification: (id) => set(state => ({ notifications: state.notifications.filter(notification => notification.id !== id) })),
  clearNotifications: () => set({ notifications: [] }),
  toggleShowNotifications: () => set(state => ({ showNotifications: !state.showNotifications })),
  hideNotifications: () => set({ showNotifications: false })
}))

type NotifyOptions = ExternalToast & {
  activityTitle?: string
  activityDescription?: string
  logToActivity?: boolean
}

function logActivity(message: string, type: Notification['type'], options?: NotifyOptions) {
  if (options?.logToActivity === false) return

  useNotificationStore.getState().addNotification(
    options?.activityTitle ?? message,
    options?.activityDescription ?? (typeof options?.description === 'string' ? options.description : message),
    type
  )
}

export function notifySuccess(message: string, options?: NotifyOptions) {
  toast.success(message, options)
  logActivity(message, 'success', options)
}

export function notifyError(message: string, options?: NotifyOptions) {
  toast.error(message, options)
  logActivity(message, 'error', options)
}

export function notifyInfo(message: string, options?: NotifyOptions) {
  toast.info(message, options)
  logActivity(message, 'info', options)
}
