import React, { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Reports from './components/Reports'

import { MonitoringProvider, useMonitoringContext } from './context/MonitoringContext'
import { ToastProvider, useToast } from './context/ToastContext'

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { addToast } = useToast()

  // Pull global state and actions from Context
  const {
    state,
    addEndpoint,
    deleteEndpoint,
    refreshEndpoint
  } = useMonitoringContext()

  const { endpoints, alerts, logs } = state

  // State calculations for header and stats
  const alertCount = alerts.filter((a) => !a.read).length
  const offlineCount = endpoints.filter((e) => e.status === 'error').length
  const systemStatus = offlineCount > 0 ? 'warning' as const : 'online' as const

  // Add Endpoint wrapped with Toast
  const handleAddEndpoint = async (newEndpoint: any) => {
    try {
      await addEndpoint(newEndpoint)
      addToast(`Successfully registered ${newEndpoint.name}!`, 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to add endpoint', 'error')
    }
  }

  // Delete Endpoint wrapped with Toast
  const handleDeleteEndpoint = async (id: string) => {
    try {
      const ep = endpoints.find(e => e.id === id)
      await deleteEndpoint(id)
      addToast(`Removed endpoint ${ep ? ep.name : ''}`, 'info')
    } catch {
      addToast('Failed to delete endpoint', 'error')
    }
  }

  // Refresh wrapped with Toast
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
          <Dashboard
            endpoints={endpoints}
            alerts={alerts}
            logs={logs}
            onRefresh={handleRefreshEndpoint}
          />
        )}
        
        {activeTab === 'settings' && (
          <Settings
            endpoints={endpoints}
            onAdd={handleAddEndpoint}
            onDelete={handleDeleteEndpoint}
          />
        )}

        {activeTab === 'reports' && (
          <Reports
            endpoints={endpoints}
          />
        )}
      </div>
    </Layout>
  )
}

function App() {
  return (
    <ToastProvider>
      <MonitoringProvider>
        <AppContent />
      </MonitoringProvider>
    </ToastProvider>
  )
}

export default App
