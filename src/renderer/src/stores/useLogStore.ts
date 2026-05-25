import { create } from 'zustand'

export interface LogEntry {
  id: number
  type: 'success' | 'error' | 'info'
  title: string
  message: string
  timestamp: string
}

interface LogState {
  logs: LogEntry[]
  isLoading: boolean
  fetchLogs: (limit?: number) => Promise<void>
  addLog: (type: 'success' | 'error' | 'info', title: string, message: string) => Promise<void>
  clearLogs: () => Promise<void>
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  isLoading: false,

  fetchLogs: async (limit = 1000) => {
    set({ isLoading: true })
    try {
      const logs = await window.api.logs.get(limit)
      set({ logs, isLoading: false })
      console.info(`[UI Logs] fetched ${logs.length} entries`)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      set({ isLoading: false })
    }
  },

  addLog: async (type, title, message) => {
    try {
      await window.api.logs.add(type, title, message)
      // Refresh logs after adding
      const logs = await window.api.logs.get(1000)
      set({ logs })
      console.info(`[UI Logs] added log: ${title}`)
    } catch (err) {
      console.error('Failed to add log:', err)
    }
  },

  clearLogs: async () => {
    try {
      await window.api.logs.clear()
      set({ logs: [] })
      console.info('[UI Logs] cleared all logs')
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }
}))
