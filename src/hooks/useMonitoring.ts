import { useState, useEffect, useCallback } from 'react'
import { Endpoint } from '../types'

export function useMonitoring() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEndpoints = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.getEndpoints()
        setEndpoints(data || [])
      } catch (err) {
        console.error('Failed to get endpoints via IPC', err)
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const addEndpoint = useCallback(async (newEp: {
    name: string
    url: string
    interval: number
    authType: string
    authConfig: any
  }) => {
    const endpoint: Endpoint = {
      id: Date.now().toString(),
      name: newEp.name,
      url: newEp.url,
      interval: newEp.interval,
      status: 'idle',
      errorCount: 0,
      consecutiveErrors: 0,
      authType: newEp.authType as any,
      authConfig: newEp.authConfig,
      responseTimeHistory: []
    }

    if (window.electronAPI) {
      await window.electronAPI.saveEndpoint(endpoint)
      await fetchEndpoints()
    } else {
      setEndpoints((prev) => [...prev, endpoint])
    }
  }, [fetchEndpoints])

  const deleteEndpoint = useCallback(async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteEndpoint(id)
      await fetchEndpoints()
    } else {
      setEndpoints((prev) => prev.filter((e) => e.id !== id))
    }
  }, [fetchEndpoints])

  const refreshEndpoint = useCallback(async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.refreshEndpoint(id)
      await fetchEndpoints()
    } else {
      setEndpoints((prev) =>
        prev.map((e) => {
          if (e.id === id) {
            const randomLatency = Math.floor(Math.random() * 150) + 40
            return {
              ...e,
              status: 'success',
              lastCheck: new Date().toISOString(),
              responseTimeHistory: [...(e.responseTimeHistory || []), randomLatency].slice(-6)
            }
          }
          return e
        })
      )
    }
  }, [fetchEndpoints])

  // Poll database updates every 3 seconds
  useEffect(() => {
    fetchEndpoints()
    const timer = setInterval(fetchEndpoints, 3000)
    return () => clearInterval(timer)
  }, [fetchEndpoints])

  return {
    endpoints,
    loading,
    addEndpoint,
    deleteEndpoint,
    refreshEndpoint,
    refetch: fetchEndpoints
  }
}
export default useMonitoring
