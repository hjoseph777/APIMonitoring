import { BarChart3, Download } from 'lucide-react'
import { UptimeChart } from './ui/UptimeChart'
import { Pill } from './ui/Pill'
import { AuthTag } from './ui/AuthTag'
import { EmptyState } from './ui/EmptyState'
import { ToneText } from './ui/ToneText'
import { useMonitoringStore } from '../store/monitoringStore'
import { useToast } from '../context/ToastContext'
import { computeFleetStats, fleetHealthTone, responseTone } from '../lib/fleetStats'

export function Reports() {
  const endpoints = useMonitoringStore(state => state.endpoints)
  const { addToast } = useToast()
  const stats = computeFleetStats(endpoints)

  const handleExportCsv = async () => {
    if (!window.electronAPI) return
    try {
      const csv = await window.electronAPI.exportLogsCsv()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `api_monitor_logs_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      addToast('Logs exported to CSV.', 'success')
    } catch (err: any) {
      addToast('Export failed: ' + (err.message || 'Unknown error'), 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Fleet summary — same computation Dashboard uses, so the two screens can't disagree */}
      <div className="glass-panel p-4 rounded-xl border flex flex-wrap items-center gap-5">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Fleet health: <ToneText tone={fleetHealthTone(stats)}>{stats.fleetHealthPct ?? '--'}%</ToneText>
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Avg response: <ToneText tone={responseTone(stats.avgResponseMs)}>{stats.avgResponseMs ?? '--'}ms</ToneText>
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Monitored: <b className="font-mono font-bold text-slate-700 dark:text-slate-200">{stats.total}</b>
        </span>
        <button
          onClick={handleExportCsv}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all cursor-pointer text-xs"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          Export CSV
        </button>
      </div>

      {endpoints.map((ep) => {
        const borderClass = ep.monitoringPaused
          ? 'border-l-4 border-l-purple-500'
          : ep.status === 'error'
          ? 'border-l-4 border-l-rose-500'
          : ep.status === 'success'
          ? 'border-l-4 border-l-emerald-500'
          : 'border-l-4 border-l-slate-300 dark:border-l-slate-700'
        return (
          <div key={ep.id} className={`glass-panel p-5 rounded-xl border space-y-4 ${borderClass}`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">{ep.name}</h3>
                  <AuthTag authType={ep.authType} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-mono select-text truncate">{ep.url}</p>
              </div>
              <Pill tone={ep.monitoringPaused ? 'purple' : ep.status === 'error' ? 'crit' : ep.status === 'success' ? 'ok' : 'neutral'}>
                {ep.monitoringPaused ? 'Paused — Auth Lockout' : ep.status === 'error' ? 'Down' : ep.status === 'success' ? 'Online' : 'Idle'}
              </Pill>
            </div>

            <UptimeChart latencyHistory={ep.responseTimeHistory} status={ep.status} intervalMinutes={ep.interval} />
          </div>
        )
      })}

      {endpoints.length === 0 && (
        <EmptyState icon={BarChart3} title="No metrics available" description="Register endpoints in Endpoint Registry to display reports." />
      )}
    </div>
  )
}
export default Reports
