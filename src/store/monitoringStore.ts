import { create } from 'zustand'
import { Endpoint, Alert, Log } from '../types'

interface MonitoringState {
  endpoints: Endpoint[]
  alerts: Alert[]
  logs: Log[]
  loading: boolean

  // Actions
  setEndpoints: (endpoints: Endpoint[]) => void
  setAlerts: (alerts: Alert[]) => void
  setLogs: (logs: Log[]) => void
  setLoading: (loading: boolean) => void

  // Async Methods
  addEndpoint: (newEp: any) => Promise<void>
  deleteEndpoint: (id: string) => Promise<void>
  refreshEndpoint: (id: string) => Promise<void>
  clearAllAlerts: () => Promise<void>
  deleteAlert: (id: string) => Promise<void>
  markAlertAsRead: (id: string) => Promise<void>
  archiveAlerts: () => Promise<void>
  clearLogs: () => Promise<void>
  copyText: (text: string, endpointName?: string) => Promise<boolean>
  refetchData: () => Promise<void>
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  endpoints: [],
  alerts: [],
  logs: [],
  loading: true,

  setEndpoints: (endpoints) => set({ endpoints, loading: false }),
  setAlerts: (alerts) => set({ alerts }),
  setLogs: (logs) => set({ logs }),
  setLoading: (loading) => set({ loading }),

  refetchData: async () => {
    if (window.electronAPI) {
      try {
        const endpointsData = await window.electronAPI.getEndpoints()
        set({ endpoints: endpointsData || [], loading: false })

        const alertsData = await window.electronAPI.getAlerts()
        set({ alerts: alertsData || [] })

        const logsData = await window.electronAPI.getLogs()
        set({ logs: logsData || [] })
      } catch (err) {
        console.error('Failed to sync data over IPC', err)
      }
    }
  },

  addEndpoint: async (newEp: any) => {
    const created: Endpoint = {
      id: window.crypto.randomUUID(),
      name: newEp.name,
      url: newEp.url,
      interval: newEp.interval,
      status: 'idle',
      errorCount: 0,
      consecutiveErrors: 0,
      authType: newEp.authType,
      authConfig: newEp.authConfig,
      responseTimeHistory: [],
      timeout: newEp.timeout,
      allowSelfSigned: newEp.allowSelfSigned === true
    }
    if (window.electronAPI) {
      await window.electronAPI.saveEndpoint(created)
      await get().refetchData()
    }
  },

  deleteEndpoint: async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteEndpoint(id)
      await get().refetchData()
    }
  },

  refreshEndpoint: async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.refreshEndpoint(id)
      await get().refetchData()
    }
  },

  clearAllAlerts: async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearAllAlerts()
      await get().refetchData()
    }
  },

  deleteAlert: async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteAlert(id)
      await get().refetchData()
    }
  },

  markAlertAsRead: async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.markAlertAsRead(id)
      await get().refetchData()
    }
  },

  archiveAlerts: async () => {
    if (window.electronAPI) {
      await window.electronAPI.archiveAlerts()
      await get().refetchData()
    }
  },

  clearLogs: async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearLogs()
      await get().refetchData()
    }
  },

  copyText: async (text: string, endpointName?: string): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.copyToClipboard(text, endpointName)
      await get().refetchData()
      return res.success
    }
    return false
  }
}))
