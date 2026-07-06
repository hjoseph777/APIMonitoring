import { useState, useEffect, useCallback } from 'react'
import { Log } from '../types'

export function useXerox() {
  const [logs, setLogs] = useState<Log[]>([])
  const [lastCopyStatus, setLastCopyStatus] = useState<'success' | 'failed' | null>(null)

  const fetchLogs = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.getLogs()
        setLogs(data || [])
      } catch (err) {
        console.error('Failed to get logs via IPC', err)
      }
    }
  }, [])

  const copyText = useCallback(async (text: string, endpointName?: string): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.copyToClipboard(text, endpointName)
      setLastCopyStatus(res.success ? 'success' : 'failed')
      await fetchLogs()
      return res.success
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setLastCopyStatus('success')
        
        const mockLog: Log = {
          id: Date.now().toString(),
          endpointName: endpointName || 'System',
          message: 'Successfully copied payload buffer to clipboard.',
          timestamp: new Date().toISOString(),
          type: 'xerox',
          success: true
        }
        setLogs((prev) => [mockLog, ...prev])
        return true
      } catch {
        setLastCopyStatus('failed')
        return false
      }
    }
  }, [fetchLogs])

  const clearLogs = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearLogs()
      await fetchLogs()
    } else {
      setLogs([])
    }
  }, [fetchLogs])

  useEffect(() => {
    fetchLogs()
    const timer = setInterval(fetchLogs, 3000)
    return () => clearInterval(timer)
  }, [fetchLogs])

  return {
    logs,
    lastCopyStatus,
    copyText,
    clearLogs,
    refetch: fetchLogs
  }
}
export default useXerox
