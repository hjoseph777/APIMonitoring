import React from 'react'
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Monitor } from 'lucide-react'
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Monitored"
          value={endpoints.length}
          bgClass="bg-slate-100/40 dark:bg-slate-900/40"
          textClass="text-slate-700 dark:text-slate-300"
          borderClass="border-slate-200 dark:border-slate-800"
        />
        <StatCard
          icon={CheckCircle}
          label="Online Services"
          value={onlineCount}
          bgClass="bg-emerald-50/40 dark:bg-emerald-950/10"
          textClass="text-emerald-600 dark:text-emerald-450"
          borderClass="border-emerald-200/50 dark:border-emerald-900/20"
        />
        <StatCard
          icon={XCircle}
          label="Offline Failures"
          value={offlineCount}
          bgClass="bg-rose-50/40 dark:bg-rose-950/10"
          textClass="text-rose-600 dark:text-rose-450"
          borderClass="border-rose-200/50 dark:border-rose-900/20"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alertCount}
          bgClass="bg-amber-50/40 dark:bg-amber-950/10"
          textClass="text-amber-600 dark:text-amber-450"
          borderClass="border-amber-200/50 dark:border-amber-900/20"
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
            <div className="p-8 text-center max-w-sm mx-auto space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
                <Monitor className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">No endpoints monitored</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-350 mt-1 select-text">
                  Register your first target server in the <strong>Endpoint Registry</strong> tab to begin live monitoring.
                </p>
              </div>
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
              <div className="text-center py-6 text-slate-500 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500">All systems operational</span>
                <p className="text-[9px] select-text">No active alerts triggered.</p>
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
              <div className="text-center py-6 text-slate-500 flex flex-col items-center justify-center gap-1.5">
                <Activity className="w-4.5 h-4.5 text-slate-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider">No logs recorded</span>
                <p className="text-[9px] select-text">Audit transaction records will appear here.</p>
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
  bgClass: string
  textClass: string
  borderClass: string
}
function StatCard({ icon: Icon, label, value, bgClass, textClass, borderClass }: StatCardProps) {
  return (
    <div className={`p-4 border rounded-2xl flex items-center justify-between shadow-sm transition-all duration-150 ${bgClass} ${borderClass}`}>
      <div>
        <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-300 block">{label}</span>
        <span className={`text-2xl font-black leading-none mt-1.5 block ${textClass}`}>{value}</span>
      </div>
      <div className={`p-2 rounded-xl bg-slate-100/60 dark:bg-slate-900/50 shrink-0`}>
        <Icon className={`w-4 h-4 ${textClass}`} />
      </div>
    </div>
  )
}
export default Dashboard
