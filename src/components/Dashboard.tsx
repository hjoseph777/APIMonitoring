import React from 'react'
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { Endpoint, Alert, Log } from '../types'
import { useToast } from '../context/ToastContext'

interface DashboardProps {
  endpoints: Endpoint[]
  alerts: Alert[]
  logs: Log[]
  onRefresh: (id: string) => Promise<void>
}

export function Dashboard({ endpoints, alerts, logs, onRefresh }: DashboardProps) {
  const { addToast } = useToast()

  const onlineCount = endpoints.filter((e) => e.status === 'success').length
  const offlineCount = endpoints.filter((e) => e.status === 'error').length
  const alertCount = alerts.filter((a) => !a.read).length

  // Filter recent xerox audits & recent alerts
  const recentAlerts = alerts.slice(0, 5)
  const recentLogs = logs.filter(l => l.type === 'xerox').slice(0, 5)

  // Copy helper
  const handleCopy = async (text: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.copyToClipboard(text)
      } else {
        await navigator.clipboard.writeText(text)
      }
      addToast('Payload copied to clipboard!', 'success')
    } catch {
      addToast('Copy failed.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      {/* Stats Grid - Minimal Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          icon={Activity}
          label="Total Endpoints"
          value={endpoints.length}
          colorClass="text-blue-500 bg-blue-500/10 border-blue-500/20"
        />
        <StatCard
          icon={CheckCircle}
          label="Online Services"
          value={onlineCount}
          colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        />
        <StatCard
          icon={XCircle}
          label="Offline Failures"
          value={offlineCount}
          colorClass="text-rose-500 bg-rose-500/10 border-rose-500/20"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alertCount}
          colorClass="text-amber-500 bg-amber-500/10 border-amber-500/20"
        />
      </div>

      {/* Endpoint Status List - Clean Tableless View */}
      <div className="glass-panel rounded-xl overflow-hidden border">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/20 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">
            Endpoint Status Cockpit
          </h2>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">Auto-polling active</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white/30 dark:bg-slate-900/10">
          {endpoints.map((ep) => {
            const isSuccess = ep.status === 'success'
            const isError = ep.status === 'error'
            return (
              <div
                key={ep.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-all duration-150"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isSuccess
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                        : isError
                        ? 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                        : 'bg-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">{ep.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono select-text truncate max-w-[280px]">
                      {ep.url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 justify-between sm:justify-end text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ep.lastCheck ? new Date(ep.lastCheck).toLocaleTimeString() : 'Never'}</span>
                  </div>
                  <div className="w-14 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {ep.responseTimeHistory && ep.responseTimeHistory.length > 0
                      ? `${ep.responseTimeHistory[ep.responseTimeHistory.length - 1]}ms`
                      : '--'}
                  </div>
                  <button
                    onClick={() => onRefresh(ep.id)}
                    className="px-2.5 py-1 text-[9px] font-bold bg-slate-200 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-md transition-all"
                  >
                    Check
                  </button>
                </div>
              </div>
            )
          })}
          {endpoints.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-700 dark:text-slate-300 font-semibold italic">
              No endpoints monitored. Go to Settings tab to register your first endpoint.
            </div>
          )}
        </div>
      </div>

      {/* Split Feeds Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Alerts Feed */}
        <div className="glass-panel p-4 rounded-xl border space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            Active Alerts Feed
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {recentAlerts.map((al) => (
              <div key={al.id} className="p-2 border-l-2 border-rose-500 bg-rose-500/5 rounded-r-md text-[10px] flex justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{al.endpointName}</span>
                  <p className="text-slate-500 select-text leading-tight">{al.message}</p>
                </div>
                <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                  {new Date(al.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="text-center text-[10px] text-slate-500 italic py-6">
                All systems quiet. No active alerts.
              </div>
            )}
          </div>
        </div>

        {/* Xerox Logs Feed */}
        <div className="glass-panel p-4 rounded-xl border space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            Xerox Logs Tracker
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => handleCopy(log.message)}
                className="p-2 bg-slate-100/30 dark:bg-slate-900/30 hover:bg-slate-200/50 dark:hover:bg-slate-850/50 border border-slate-200/50 dark:border-slate-800 rounded-md text-[10px] flex items-center justify-between cursor-pointer transition-all gap-3"
              >
                <div className="truncate">
                  <span className="font-bold text-slate-700 dark:text-slate-200 mr-2">{log.endpointName}</span>
                  <span className="text-slate-500 font-mono">{log.message}</span>
                </div>
                <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div className="text-center text-[10px] text-slate-500 italic py-6">
                No copy audits logged.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Reusable StatCard Component */
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  colorClass: string
}
function StatCard({ icon: Icon, label, value, colorClass }: StatCardProps) {
  return (
    <div className={`p-3.5 border rounded-xl flex items-center justify-between transition-all ${colorClass}`}>
      <div>
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">{label}</span>
        <span className="text-xl font-extrabold leading-none mt-1 block">{value}</span>
      </div>
      <Icon className="w-5 h-5 opacity-70 shrink-0" />
    </div>
  )
}
export default Dashboard
