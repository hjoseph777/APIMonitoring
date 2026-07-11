import React, { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Search } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useMonitoringStore } from '../store/monitoringStore'
import { Pill } from './ui/Pill'
import { AuthTag } from './ui/AuthTag'
import { Panel } from './ui/Panel'
import { EmptyState } from './ui/EmptyState'
import { ToneText } from './ui/ToneText'
import { computeFleetStats, fleetHealthTone, responseTone } from '../lib/fleetStats'

const STATUS_RANK: Record<string, number> = { error: 0, idle: 1, success: 2 }

export function Dashboard() {
  const { addToast } = useToast()
  const [query, setQuery] = useState('')

  const endpoints = useMonitoringStore(state => state.endpoints)
  const alerts = useMonitoringStore(state => state.alerts)
  const logs = useMonitoringStore(state => state.logs)
  const onRefresh = useMonitoringStore(state => state.refreshEndpoint)
  const markAlertAsRead = useMonitoringStore(state => state.markAlertAsRead)
  const snapshot = useMonitoringStore(state => state.snapshot)
  const maybeRefreshSnapshot = useMonitoringStore(state => state.maybeRefreshSnapshot)

  // Roll the KPI trend baseline forward on mount and periodically while this tab is open
  useEffect(() => {
    maybeRefreshSnapshot()
    const timer = setInterval(maybeRefreshSnapshot, 60_000)
    return () => clearInterval(timer)
  }, [maybeRefreshSnapshot])

  const stats = useMemo(() => computeFleetStats(endpoints), [endpoints])

  const visibleEndpoints = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? endpoints.filter(ep =>
          ep.name.toLowerCase().includes(q) ||
          ep.url.toLowerCase().includes(q) ||
          ep.authType.toLowerCase().includes(q)
        )
      : endpoints
    return [...filtered].sort((a, b) => (STATUS_RANK[a.status] ?? 1) - (STATUS_RANK[b.status] ?? 1))
  }, [endpoints, query])

  const alertCount = alerts.filter((a) => !a.read).length
  const recentAlerts = alerts.filter(a => !a.read).slice(0, 5)
  const recentLogs = logs.filter(l => l.type === 'info' || l.type === 'error').slice(0, 5)

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

  const handleAcknowledge = async (id: string) => {
    try {
      await markAlertAsRead(id)
    } catch {
      addToast('Failed to acknowledge alert.', 'error')
    }
  }

  const handleRefresh = async (id: string) => {
    try {
      await onRefresh(id)
      addToast('Endpoint check executed.', 'success')
    } catch {
      addToast('Failed to refresh endpoint check.', 'error')
    }
  }

  const delta = (key: 'total' | 'online' | 'down' | 'degraded') =>
    snapshot ? stats[key] - snapshot[key] : 0

  return (
    <div className="space-y-5">
      {/* Stats Grid - Minimal Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Monitored"
          value={stats.total}
          delta={delta('total')}
          deltaTone="neutral"
          bgClass="bg-slate-100/60 dark:bg-slate-800/40"
          textClass="text-slate-700 dark:text-slate-100"
          borderClass="border-slate-200 dark:border-slate-700"
        />
        <StatCard
          icon={CheckCircle}
          label="Online Services"
          value={stats.online}
          delta={delta('online')}
          deltaTone={delta('online') >= 0 ? 'ok' : 'crit'}
          bgClass="bg-emerald-50/60 dark:bg-emerald-900/20"
          textClass="text-emerald-700 dark:text-emerald-300"
          borderClass="border-emerald-200 dark:border-emerald-800/50"
        />
        <StatCard
          icon={XCircle}
          label="Offline Failures"
          value={stats.down}
          delta={delta('down')}
          deltaTone={delta('down') <= 0 ? 'ok' : 'crit'}
          bgClass="bg-rose-50/60 dark:bg-rose-900/20"
          textClass="text-rose-700 dark:text-rose-300"
          borderClass="border-rose-200 dark:border-rose-800/50"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alertCount}
          delta={0}
          deltaTone="neutral"
          bgClass="bg-amber-50/60 dark:bg-amber-900/20"
          textClass="text-amber-700 dark:text-amber-300"
          borderClass="border-amber-200 dark:border-amber-800/50"
        />
      </div>

      {/* Fleet health strip — threshold/state colored instead of plain text */}
      <div className="flex flex-wrap items-center gap-5 px-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Fleet health: <ToneText tone={fleetHealthTone(stats)}>{stats.fleetHealthPct ?? '--'}%</ToneText>
        </span>
        <span>
          Avg response: <ToneText tone={responseTone(stats.avgResponseMs)}>{stats.avgResponseMs ?? '--'}ms</ToneText>
        </span>
      </div>

      {/* Endpoint Status List - Clean Tableless View */}
      <Panel title="Endpoint Status Cockpit">
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--well)]">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter endpoints by name, URL, or auth type…"
              className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-y-0 dark:space-y-3 px-4 py-3 bg-transparent">
          {visibleEndpoints.map((ep) => {
            const isSuccess = ep.status === 'success'
            const isError = ep.status === 'error'
            const latest = ep.responseTimeHistory && ep.responseTimeHistory.length > 0
              ? ep.responseTimeHistory[ep.responseTimeHistory.length - 1]
              : undefined
            return (
              <div
                key={ep.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 dark:p-3 gap-2 bg-slate-50 dark:bg-[#383a48] dark:rounded-md transition-all duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      ep.monitoringPaused
                        ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                        : isSuccess
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                        : isError
                        ? 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                        : 'bg-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-300">{ep.name}</span>
                      <AuthTag authType={ep.authType} />
                      {ep.monitoringPaused && <Pill tone="purple">Paused — Auth Lockout</Pill>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white font-mono select-text truncate max-w-[280px]">
                      {ep.url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end text-xs text-slate-500 dark:text-slate-400">
                  <Sparkline history={ep.responseTimeHistory} tone={isError ? 'crit' : isSuccess ? 'ok' : 'neutral'} />
                  <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{ep.lastCheck ? new Date(ep.lastCheck).toLocaleTimeString() : 'Never'}</span>
                  </div>
                  <div className="w-14 text-right">
                    {latest !== undefined ? <ToneText tone={responseTone(latest, ep.degradedMs)}>{latest}ms</ToneText> : <span className="font-mono text-slate-400">--</span>}
                  </div>
                  <button
                    onClick={() => handleRefresh(ep.id)}
                    className="px-2.5 py-1 text-xs font-bold bg-slate-200 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-md transition-all"
                  >
                    Check
                  </button>
                </div>
              </div>
            )
          })}
          {endpoints.length === 0 && (
            <EmptyState title="No endpoints monitored" description="Go to Endpoint Registry to register your first endpoint." />
          )}
          {endpoints.length > 0 && visibleEndpoints.length === 0 && (
            <EmptyState title="No endpoints match your filter" />
          )}
        </div>
      </Panel>

      {/* Split Feeds Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Alerts Feed */}
        <Panel title="Active Alerts Feed" bodyClassName="p-4 space-y-2.5">
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {recentAlerts.map((al) => (
              <div key={al.id} className="p-3 border-l-4 border-rose-500 bg-[var(--well)] rounded-r-md text-xs flex justify-between gap-3 items-start">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-300">{al.endpointName}</span>
                    <Pill tone="crit">Critical</Pill>
                  </div>
                  <p className="select-text leading-tight font-medium text-slate-600 dark:text-slate-300">{al.message}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {new Date(al.timestamp).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => handleAcknowledge(al.id)}
                    className="text-xs font-bold px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <EmptyState icon={CheckCircle} title="All systems operational" description="No active alerts triggered." />
            )}
          </div>
        </Panel>

        {/* Recent Activity Feed */}
        <Panel title="Recent Monitor Activity" bodyClassName="p-4 space-y-2.5">
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => handleCopy(log.message)}
                className="p-3 bg-[var(--well)] hover:opacity-80 border border-[var(--border-color)] rounded-md text-xs flex items-center justify-between cursor-pointer transition-all gap-3"
              >
                <div className="truncate pl-2">
                  <span className="font-bold text-slate-900 dark:text-slate-200 mr-2">{log.endpointName}</span>
                  <span className={`font-mono ${log.type === 'error' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {log.message}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 font-mono pr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <EmptyState icon={Activity} title="No logs recorded" description="Audit transaction records will appear here." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

// StatCard — small metric tile used in the stats row at the top of the dashboard
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  delta: number
  deltaTone: 'ok' | 'crit' | 'neutral'
  bgClass: string
  textClass: string
  borderClass: string
}
function StatCard({ icon: Icon, label, value, delta, deltaTone, bgClass, textClass, borderClass }: StatCardProps) {
  const deltaColor = deltaTone === 'ok' ? 'var(--color-green)' : deltaTone === 'crit' ? 'var(--color-red)' : 'var(--text-secondary)'
  return (
    <div className={`p-4 border rounded-2xl flex items-center justify-between shadow-sm transition-all duration-150 ${bgClass} ${borderClass}`}>
      <div>
        <span className="text-xs uppercase font-bold tracking-widest text-slate-600 dark:text-slate-200 block mb-0.5">{label}</span>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className={`text-2xl font-black leading-none ${textClass}`}>{value}</span>
          <span className="text-xs font-bold font-mono" style={{ color: deltaColor }}>
            {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '+0'}
          </span>
        </div>
      </div>
      <div className={`p-2 rounded-xl bg-slate-100/60 dark:bg-slate-900/50 shrink-0`}>
        <Icon className={`w-4 h-4 ${textClass}`} />
      </div>
    </div>
  )
}

function Sparkline({ history, tone }: { history?: number[]; tone: 'ok' | 'crit' | 'neutral' }) {
  if (!history || history.length < 2) return <span className="w-[46px]" />
  const w = 46
  const h = 18
  const max = Math.max(...history)
  const min = Math.min(...history)
  const range = max - min || 1
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const colorVar = tone === 'ok' ? '--color-green' : tone === 'crit' ? '--color-red' : '--text-secondary'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={`var(${colorVar})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default Dashboard
