import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { Endpoint, Alert, Log } from '../types'

interface MonitoringState {
  endpoints: Endpoint[]
  alerts: Alert[]
  logs: Log[]
  loading: boolean
}

type Action =
  | { type: 'SET_ENDPOINTS'; payload: Endpoint[] }
  | { type: 'SET_ALERTS'; payload: Alert[] }
  | { type: 'SET_LOGS'; payload: Log[] }
  | { type: 'SET_LOADING'; payload: boolean }

const NOW = new Date()
const t = (offsetMinutes: number) => new Date(NOW.getTime() - offsetMinutes * 60000).toISOString()

const SEED_ENDPOINTS: Endpoint[] = [
  {
    id: 'seed-1',
    name: 'ERP Sales API',
    url: 'http://erp-server.xerox.local:8080/api/sales',
    interval: 5,
    status: 'success',
    lastCheck: t(2),
    errorCount: 0,
    consecutiveErrors: 0,
    authType: 'apiKey',
    authConfig: { type: 'apiKey', key: 'X-API-Key', value: '***', location: 'header' },
    responseTimeHistory: [120, 135, 118, 142, 127, 110, 131],
    timeout: 10
  },
  {
    id: 'seed-2',
    name: 'HR Portal Service',
    url: 'http://hr-portal.xerox.local:9090/api/employees',
    interval: 10,
    status: 'error',
    lastCheck: t(8),
    errorCount: 5,
    consecutiveErrors: 3,
    authType: 'ntlm',
    authConfig: { type: 'ntlm', username: 'svc_monitor', password: '***', domain: 'XEROX' },
    responseTimeHistory: [220, 540, 0, 0, 0],
    timeout: 15
  },
  {
    id: 'seed-3',
    name: 'Finance Reporting',
    url: 'https://finance.xerox.internal/api/reports',
    interval: 15,
    status: 'success',
    lastCheck: t(1),
    errorCount: 1,
    consecutiveErrors: 0,
    authType: 'basic',
    authConfig: { type: 'basic', username: 'monitor_svc', password: '***' },
    responseTimeHistory: [88, 94, 101, 97, 85, 90, 92],
    timeout: 30
  },
  {
    id: 'seed-4',
    name: 'Inventory Sync',
    url: 'http://inventory.xerox.local:7777/api/stock',
    interval: 5,
    status: 'idle',
    lastCheck: t(5),
    errorCount: 0,
    consecutiveErrors: 0,
    authType: 'none',
    authConfig: { type: 'none' },
    responseTimeHistory: [310, 298, 322, 315],
    timeout: 10
  }
]

const SEED_ALERTS: Alert[] = [
  { id: 'sa-1', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'Connection refused — NTLM auth failed after 3 retries', timestamp: t(8), read: false },
  { id: 'sa-2', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'Endpoint unreachable — response timeout after 15s', timestamp: t(23), read: false },
  { id: 'sa-3', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'HTTP 503 Service Unavailable', timestamp: t(45), read: true },
  { id: 'sa-4', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'Response time spike detected — 540ms (threshold: 300ms)', timestamp: t(60), read: true },
  { id: 'sa-5', endpointId: 'seed-3', endpointName: 'Finance Reporting', message: 'HTTP 401 Unauthorized — credentials may have expired', timestamp: t(120), read: true },
  { id: 'sa-6', endpointId: 'seed-4', endpointName: 'Inventory Sync', message: 'First check pending — endpoint registered', timestamp: t(5), read: true }
]

const SEED_LOGS: Log[] = [
  { id: 'sl-1', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'HTTP 200 OK — 127ms', timestamp: t(2), type: 'info' },
  { id: 'sl-2', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'Connection refused — retrying in 5 min', timestamp: t(8), type: 'error' },
  { id: 'sl-3', endpointId: 'seed-3', endpointName: 'Finance Reporting', message: 'HTTP 200 OK — 90ms', timestamp: t(1), type: 'info' },
  { id: 'sl-4', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'Xerox audit log exported — 48 records copied', timestamp: t(15), type: 'xerox', success: true },
  { id: 'sl-5', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'HTTP 503 — endpoint marked as failed', timestamp: t(45), type: 'error' },
  { id: 'sl-6', endpointId: 'seed-3', endpointName: 'Finance Reporting', message: 'Xerox audit log exported — 12 records copied', timestamp: t(30), type: 'xerox', success: true },
  { id: 'sl-7', endpointId: 'seed-4', endpointName: 'Inventory Sync', message: 'HTTP 200 OK — 315ms', timestamp: t(5), type: 'info' },
  { id: 'sl-8', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'HTTP 200 OK — 131ms', timestamp: t(7), type: 'info' }
]

const initialState: MonitoringState = {
  endpoints: SEED_ENDPOINTS,
  alerts: SEED_ALERTS,
  logs: SEED_LOGS,
  loading: false
}

function monitoringReducer(state: MonitoringState, action: Action): MonitoringState {
  switch (action.type) {
    case 'SET_ENDPOINTS':
      return { ...state, endpoints: action.payload, loading: false }
    case 'SET_ALERTS':
      return { ...state, alerts: action.payload }
    case 'SET_LOGS':
      return { ...state, logs: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    default:
      return state
  }
}

interface MonitoringContextType {
  state: MonitoringState
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

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined)

export function useMonitoringContext() {
  const context = useContext(MonitoringContext)
  if (!context) throw new Error('useMonitoringContext must be used within a MonitoringProvider')
  return context
}

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(monitoringReducer, initialState)

  const refetchData = async () => {
    if (window.electronAPI) {
      try {
        const endpointsData = await window.electronAPI.getEndpoints()
        // Only overwrite seed data if the DB actually has real records
        dispatch({ type: 'SET_ENDPOINTS', payload: endpointsData?.length ? endpointsData : SEED_ENDPOINTS })

        const alertsData = await window.electronAPI.getAlerts()
        dispatch({ type: 'SET_ALERTS', payload: alertsData?.length ? alertsData : SEED_ALERTS })

        const logsData = await window.electronAPI.getLogs()
        dispatch({ type: 'SET_LOGS', payload: logsData?.length ? logsData : SEED_LOGS })
      } catch (err) {
        console.error('Failed to sync data over IPC', err)
        // Keep seed data on error
      }
    }
  }

  const addEndpoint = async (newEp: any) => {
    const created: Endpoint = {
      id: Date.now().toString(),
      name: newEp.name,
      url: newEp.url,
      interval: newEp.interval,
      status: 'idle',
      errorCount: 0,
      consecutiveErrors: 0,
      authType: newEp.authType,
      authConfig: newEp.authConfig,
      responseTimeHistory: []
    }
    if (window.electronAPI) {
      await window.electronAPI.saveEndpoint(created)
      await refetchData()
    }
  }

  const deleteEndpoint = async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteEndpoint(id)
      await refetchData()
    }
  }

  const refreshEndpoint = async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.refreshEndpoint(id)
      await refetchData()
    }
  }

  const clearAllAlerts = async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearAllAlerts()
      await refetchData()
    }
  }

  const deleteAlert = async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteAlert(id)
      await refetchData()
    }
  }

  const markAlertAsRead = async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.markAlertAsRead(id)
      await refetchData()
    }
  }

  const archiveAlerts = async () => {
    if (window.electronAPI) {
      await window.electronAPI.archiveAlerts()
      await refetchData()
    }
  }

  const clearLogs = async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearLogs()
      await refetchData()
    }
  }

  const copyText = async (text: string, endpointName?: string): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.copyToClipboard(text, endpointName)
      await refetchData()
      return res.success
    }
    return false
  }

  // Periodic polling check loop
  useEffect(() => {
    refetchData()
    const timer = setInterval(refetchData, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <MonitoringContext.Provider
      value={{
        state,
        addEndpoint,
        deleteEndpoint,
        refreshEndpoint,
        clearAllAlerts,
        deleteAlert,
        markAlertAsRead,
        archiveAlerts,
        clearLogs,
        copyText,
        refetchData
      }}
    >
      {children}
    </MonitoringContext.Provider>
  )
}
