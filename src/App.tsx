import React, { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Reports from './components/Reports'
import NotificationJson from './components/NotificationJson'

import { useMonitoringStore } from './store/monitoringStore'
import { ToastProvider, useToast } from './context/ToastContext'

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { addToast } = useToast()

  const endpoints = useMonitoringStore(state => state.endpoints)
  const alerts = useMonitoringStore(state => state.alerts)
  const addEndpoint = useMonitoringStore(state => state.addEndpoint)
  const deleteEndpoint = useMonitoringStore(state => state.deleteEndpoint)
  const refreshEndpoint = useMonitoringStore(state => state.refreshEndpoint)
  const refetchData = useMonitoringStore(state => state.refetchData)

  // Sync state from the main process every 3 seconds so the UI stays up to date
  useEffect(() => {
    refetchData()
    const timer = setInterval(refetchData, 3000)
    return () => clearInterval(timer)
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

  // Wire in a toast notification when an endpoint is successfully added or fails
  const handleAddEndpoint = async (newEndpoint: any) => {
    try {
      await addEndpoint(newEndpoint)
      addToast(`Successfully registered ${newEndpoint.name}!`, 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to add endpoint', 'error')
    }
  }

  // Confirm deletion with a toast so the user knows it went through
  const handleDeleteEndpoint = async (id: string) => {
    try {
      const ep = endpoints.find(e => e.id === id)
      await deleteEndpoint(id)
      addToast(`Removed endpoint ${ep ? ep.name : ''}`, 'info')
    } catch {
      addToast('Failed to delete endpoint', 'error')
    }
  }

  // Trigger an immediate check outside the normal polling cycle
  const handleRefreshEndpoint = async (id: string) => {
    try {
      await refreshEndpoint(id)
      addToast('Endpoint check executed.', 'success')
    } catch {
      addToast('Failed to refresh endpoint check.', 'error')
    }
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      alertCount={alertCount}
      systemStatus={systemStatus}
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
