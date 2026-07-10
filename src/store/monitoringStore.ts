import { create } from 'zustand'
import { Endpoint, Alert, Log } from '../types'
import { computeFleetStats } from '../lib/fleetStats'

export interface FleetSnapshot {
  total: number
  online: number
  down: number
  degraded: number
  capturedAt: number
}

const SNAPSHOT_KEY = 'fleet-snapshot'
const SNAPSHOT_STALE_MS = 15 * 60 * 1000

interface MonitoringState {
  endpoints: Endpoint[]
  alerts: Alert[]
  logs: Log[]
  snapshot: FleetSnapshot | null

  // Async Methods
  addEndpoint: (newEp: any) => Promise<void>
  updateEndpoint: (id: string, changes: any) => Promise<void>
  deleteEndpoint: (id: string) => Promise<void>
  refreshEndpoint: (id: string) => Promise<void>
  clearAllAlerts: () => Promise<void>
  deleteAlert: (id: string) => Promise<void>
  markAlertAsRead: (id: string) => Promise<void>
  archiveAlerts: () => Promise<void>
  clearLogs: () => Promise<void>
  refetchData: () => Promise<void>
  // Rolls the KPI trend baseline forward once SNAPSHOT_STALE_MS has elapsed; a no-op otherwise
  maybeRefreshSnapshot: () => void
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  endpoints: [],
  alerts: [],
  logs: [],
  snapshot: null,

  refetchData: async () => {
    if (window.electronAPI) {
      try {
        const endpointsData = await window.electronAPI.getEndpoints()
        set({ endpoints: endpointsData || [] })

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

  // saveEndpoint is INSERT OR REPLACE keyed by id, so editing just re-saves the same id
  // with changed fields — no new IPC channel needed.
  updateEndpoint: async (id: string, changes: any) => {
    const existing = get().endpoints.find(e => e.id === id)
    if (!existing) return
    const updated: Endpoint = {
      ...existing,
      name: changes.name ?? existing.name,
      url: changes.url ?? existing.url,
      interval: changes.interval ?? existing.interval,
      authType: changes.authType ?? existing.authType,
      authConfig: changes.authConfig ?? existing.authConfig,
      timeout: changes.timeout ?? existing.timeout,
      allowSelfSigned: changes.allowSelfSigned ?? existing.allowSelfSigned
    }
    if (window.electronAPI) {
      await window.electronAPI.saveEndpoint(updated)
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

  maybeRefreshSnapshot: () => {
    const now = Date.now()
    let snap: FleetSnapshot | null = null
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY)
      snap = raw ? JSON.parse(raw) : null
    } catch {
      snap = null
    }

    if (!snap || now - snap.capturedAt > SNAPSHOT_STALE_MS) {
      const stats = computeFleetStats(get().endpoints)
      snap = { total: stats.total, online: stats.online, down: stats.down, degraded: stats.degraded, capturedAt: now }
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap))
    }
    set({ snapshot: snap })
  }
}))
