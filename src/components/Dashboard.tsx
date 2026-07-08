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

  // Show only the most recent 5 items in each dashboard feed
  const recentAlerts = alerts.slice(0, 5)
  const recentLogs = logs.filter(l => l.type === 'xerox').slice(0, 5)

  // Copy a log message to clipboard from the dashboard quick-feed
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
          bgClass="bg-slate-100/60 dark:bg-slate-800/40"
          textClass="text-slate-700 dark:text-slate-100"
          borderClass="border-slate-200 dark:border-slate-700"
        />
        <StatCard
          icon={CheckCircle}
          label="Online Services"
          value={onlineCount}
          bgClass="bg-emerald-50/60 dark:bg-emerald-900/20"
          textClass="text-emerald-700 dark:text-emerald-300"
          borderClass="border-emerald-200 dark:border-emerald-800/50"
        />
        <StatCard
          icon={XCircle}
          label="Offline Failures"
          value={offlineCount}
          bgClass="bg-rose-50/60 dark:bg-rose-900/20"
          textClass="text-rose-700 dark:text-rose-300"
          borderClass="border-rose-200 dark:border-rose-800/50"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alertCount}
          bgClass="bg-amber-50/60 dark:bg-amber-900/20"
          textClass="text-amber-700 dark:text-amber-300"
          borderClass="border-amber-200 dark:border-amber-800/50"
        />
      </div>

      {/* Endpoint Status List - Clean Tableless View */}
      <div className="bg-white dark:bg-[#2a2d3d] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg dark:pb-4">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-100 dark:bg-[#4a5f82] flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#6ba4f8]">
            Endpoint Status Cockpit
          </h2>
          <span className="text-[10px] text-blue-500 dark:text-[#6ba4f8]/80 font-mono font-bold">Auto-polling active</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-y-0 dark:space-y-3 dark:px-4 dark:pt-4 bg-transparent">
          {endpoints.map((ep) => {
            const isSuccess = ep.status === 'success'
            const isError = ep.status === 'error'
            return (
              <div
                key={ep.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 dark:p-3 gap-2 bg-slate-50 dark:bg-[#383a48] dark:rounded-md transition-all duration-150"
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
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-300">{ep.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-white font-mono select-text truncate max-w-[280px]">
                      {ep.url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 justify-between sm:justify-end text-[10px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{ep.lastCheck ? new Date(ep.lastCheck).toLocaleTimeString() : 'Never'}</span>
                  </div>
                  <div className="w-14 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {ep.responseTimeHistory && ep.responseTimeHistory.length > 0
                      ? `${ep.responseTimeHistory[ep.responseTimeHistory.length - 1]}ms`
                      : '--'}
                  </div>
                  <button
                    onClick={() => onRefresh(ep.id)}
                    className="px-2.5 py-1 text-[9px] font-bold bg-slate-200 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-md transition-all"
                  >
                    Check
                  </button>
                </div>
              </div>
            )
          })}
          {endpoints.length === 0 && (
            <div className="p-8 dark:p-4 text-center text-xs text-slate-500 dark:text-slate-400 italic dark:bg-[#383a48] dark:rounded-md font-semibold">
              No endpoints monitored. Go to Settings tab to register your first endpoint.
            </div>
          )}
        </div>
      </div>

      {/* Split Feeds Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Alerts Feed */}
        <div className="bg-white dark:bg-[#1e2230] shadow-sm dark:shadow-xl p-4 rounded-[1.25rem] border border-slate-200 dark:border-slate-700/60 space-y-2.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-white border-b border-slate-200 dark:border-white pb-1.5 mb-1.5">
            Active Alerts Feed
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {recentAlerts.map((al, idx) => {
              // Assign colors based on index to mimic the screenshot (Teal, Orange, Yellow)
              const statusColorsLight = ['text-teal-600', 'text-orange-600', 'text-yellow-600']
              const statusColorsDark = ['dark:text-teal-400', 'dark:text-orange-400', 'dark:text-yellow-400']
              const colorClassLight = statusColorsLight[idx % statusColorsLight.length]
              const colorClassDark = statusColorsDark[idx % statusColorsDark.length]

              return (
                <div key={al.id} className="p-3 border-l-4 border-rose-500 bg-slate-50 dark:bg-slate-800/80 rounded-r-md text-[11px] flex justify-between gap-3 items-start">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-300">{al.endpointName}</span>
                    <p className={`select-text leading-tight font-medium ${colorClassLight} ${colorClassDark}`}>{al.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                    {new Date(al.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )
            })}
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
        <div className="bg-white dark:bg-[#1e2230] shadow-sm dark:shadow-xl p-4 rounded-[1.25rem] border border-slate-200 dark:border-slate-700/60 space-y-2.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-white border-b border-slate-200 dark:border-white pb-1.5 mb-1.5">
            Xerox Logs Tracker
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => handleCopy(log.message)}
                className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-400/90 dark:hover:bg-slate-300 border border-slate-200 dark:border-slate-400 rounded-md text-[11px] flex items-center justify-between cursor-pointer transition-all gap-3"
              >
                <div className="truncate pl-2">
                  <span className="font-bold text-slate-900 mr-2">{log.endpointName}</span>
                  <span className="text-slate-600 dark:text-slate-800 font-mono">{log.message}</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-800 shrink-0 font-mono pr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div className="text-center py-6 text-slate-500 flex flex-col items-center justify-center gap-1.5">
                <Activity className="w-4.5 h-4.5 text-slate-400 dark:text-slate-300" />
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

// StatCard — small metric tile used in the stats row at the top of the dashboard
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
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600 dark:text-slate-200 block mb-0.5">{label}</span>
        <span className={`text-2xl font-black leading-none mt-1.5 block ${textClass}`}>{value}</span>
      </div>
      <div className={`p-2 rounded-xl bg-slate-100/60 dark:bg-slate-900/50 shrink-0`}>
        <Icon className={`w-4 h-4 ${textClass}`} />
      </div>
    </div>
  )
}
export default Dashboard
