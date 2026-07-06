import { useState, useEffect, useCallback } from 'react'
import { Alert } from '../types'

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  const fetchAlerts = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.getAlerts()
        setAlerts(data || [])
      } catch (err) {
        console.error('Failed to get alerts via IPC', err)
      }
    }
  }, [])

  const clearAll = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearAllAlerts()
      await fetchAlerts()
    } else {
      setAlerts([])
    }
  }, [fetchAlerts])

  const deleteAlert = useCallback(async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteAlert(id)
      await fetchAlerts()
    } else {
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    }
  }, [fetchAlerts])

  const markAsRead = useCallback(async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.markAlertAsRead(id)
      await fetchAlerts()
    } else {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
    }
  }, [fetchAlerts])

  const archiveAlerts = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.archiveAlerts()
      await fetchAlerts()
    } else {
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
    }
  }, [fetchAlerts])

  useEffect(() => {
    fetchAlerts()
    const timer = setInterval(fetchAlerts, 3000)
    return () => clearInterval(timer)
  }, [fetchAlerts])

  return {
    alerts,
    clearAll,
    deleteAlert,
    markAsRead,
    archiveAlerts,
    refetch: fetchAlerts
  }
}
export default useAlerts
