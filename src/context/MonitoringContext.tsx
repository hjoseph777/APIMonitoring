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

const initialState: MonitoringState = {
  endpoints: [],
  alerts: [],
  logs: [],
  loading: true
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
        dispatch({ type: 'SET_ENDPOINTS', payload: endpointsData || [] })

        const alertsData = await window.electronAPI.getAlerts()
        dispatch({ type: 'SET_ALERTS', payload: alertsData || [] })

        const logsData = await window.electronAPI.getLogs()
        dispatch({ type: 'SET_LOGS', payload: logsData || [] })
      } catch (err) {
        console.error('Failed to sync data over IPC', err)
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

  // Sync state from the main process every 3 seconds so the UI stays
  // up to date with any background monitoring events that occurred
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
