import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Reports from './components/Reports'
import NotificationJson from './components/NotificationJson'

import { useMonitoringStore } from './store/monitoringStore'
import { ToastProvider } from './context/ToastContext'

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const endpoints = useMonitoringStore(state => state.endpoints)
  const alerts = useMonitoringStore(state => state.alerts)
  const refetchData = useMonitoringStore(state => state.refetchData)

  // P16-14: sync state via IPC push from main process; fall back to polling in dev/browser
  useEffect(() => {
    refetchData() // initial load
    if (window.electronAPI?.onStateChanged) {
      window.electronAPI.onStateChanged(refetchData)
      return () => window.electronAPI?.offStateChanged?.()
    } else {
      const timer = setInterval(refetchData, 3000)
      return () => clearInterval(timer)
    }
  }, [refetchData])

  const alertCount = alerts.filter((a) => !a.read).length
  const offlineCount = endpoints.filter((e) => e.status === 'error').length

  // Roll up into a single system health label shown in the header
  const systemStatus = endpoints.length === 0
    ? 'online' as const
    : offlineCount === endpoints.length
    ? 'offline' as const
    : offlineCount > 0
    ? 'warning' as const
    : 'online' as const

  // Most recent check time across all endpoints, shown in the header instead of a redundant page title
  const lastSync = endpoints.reduce<string | undefined>((latest, ep) => {
    if (!ep.lastCheck) return latest
    return !latest || ep.lastCheck > latest ? ep.lastCheck : latest
  }, undefined)

  // Real TLS posture (replaces the old static "Shield Active" claim) — counts endpoints
  // that opted out of certificate validation via allowSelfSigned
  const tlsSummary = {
    total: endpoints.length,
    selfSigned: endpoints.filter((e) => e.allowSelfSigned).length
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      alertCount={alertCount}
      systemStatus={systemStatus}
      lastSync={lastSync ? new Date(lastSync).toLocaleTimeString() : undefined}
      tlsSummary={tlsSummary}
    >
      <div className="space-y-4">
        {/* Main Content Router */}
        {activeTab === 'dashboard' && (
          <Dashboard />
        )}
        
        {activeTab === 'settings' && (
          <Settings />
        )}

        {activeTab === 'reports' && (
          <Reports />
        )}

        {activeTab === 'notification-json' && (
          <NotificationJson />
        )}
      </div>
    </Layout>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
