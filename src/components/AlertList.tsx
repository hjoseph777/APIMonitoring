import React, { useState, useMemo } from 'react'
import { AlertTriangle, Trash2, ShieldAlert, Archive, Check } from 'lucide-react'
import { Alert } from '../types'

interface AlertListProps {
  alerts: Alert[]
  onClearAll: () => void
  onDeleteAlert: (id: string) => void
  onMarkAsRead: (id: string) => void
  onArchiveAlerts: () => void
}

export function AlertList({ alerts, onClearAll, onDeleteAlert, onMarkAsRead, onArchiveAlerts }: AlertListProps) {
  const [viewMode, setViewMode] = useState<'feed' | 'grouped'>('feed')

  // Sort alerts: newest first
  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [alerts])

  // Group alerts by endpoint name
  const groupedAlerts = useMemo(() => {
    const groups: { [key: string]: Alert[] } = {}
    alerts.forEach((alert) => {
      if (!groups[alert.endpointName]) {
        groups[alert.endpointName] = []
      }
      groups[alert.endpointName].push(alert)
    })
    return groups
  }, [alerts])

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/10 border border-slate-850 rounded-2xl">
      <svg
        className="w-16 h-16 text-slate-700 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
      <h3 className="text-sm font-bold text-white mb-1">System Healthy</h3>
      <p className="text-xs text-slate-500 max-w-sm">
        All registered endpoints are responding successfully. No active alerts.
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-slate-850 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('feed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'feed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Alerts Feed
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Grouped by Endpoint
          </button>
        </div>

        {alerts.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onArchiveAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 hover:bg-slate-850 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive Old
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 bg-red-500/10 hover:bg-red-500/25 rounded-lg text-xs font-semibold text-red-400 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        renderEmptyState()
      ) : viewMode === 'feed' ? (
        /* Alerts feed list view */
        <div className="space-y-4">
          {sortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border flex items-start justify-between gap-4 transition-all ${
                alert.read
                  ? 'bg-slate-900/10 border-slate-850 text-slate-400'
                  : 'bg-red-500/5 border-red-500/10 text-slate-100 shadow-md shadow-red-500/5'
              }`}
            >
              <div className="flex gap-3 min-w-0">
                <div className={`p-2 rounded-xl mt-0.5 ${alert.read ? 'bg-slate-800 text-slate-500' : 'bg-red-500/15 text-red-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-400">
                      {alert.endpointName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs leading-normal select-text">{alert.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!alert.read && (
                  <button
                    onClick={() => onMarkAsRead(alert.id)}
                    className="p-2 border border-slate-800 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-green-400 transition-all"
                    title="Mark as Read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDeleteAlert(alert.id)}
                  className="p-2 border border-slate-800 hover:bg-rose-950/20 rounded-lg text-slate-400 hover:text-rose-400 transition-all"
                  title="Delete Alert"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grouped view list */
        <div className="space-y-6">
          {Object.entries(groupedAlerts).map(([endpointName, groupAlerts]) => (
            <div key={endpointName} className="glass-panel p-5 rounded-2xl border border-slate-850 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">{endpointName}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">
                  {groupAlerts.length}
                </span>
              </div>
              <div className="space-y-3">
                {groupAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between text-xs py-1">
                    <div className="space-y-1">
                      <p className="text-slate-300">{alert.message}</p>
                      <span className="text-[10px] text-slate-500">{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => onDeleteAlert(alert.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default AlertList
