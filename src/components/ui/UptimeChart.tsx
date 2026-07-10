import React from 'react'
import { ShieldCheck, ShieldX, ShieldQuestion } from 'lucide-react'
import { Pill } from './Pill'

interface UptimeChartProps {
  latencyHistory?: number[]
  status: 'success' | 'error' | 'idle'
  intervalMinutes?: number
}

export function UptimeChart({ latencyHistory = [], status, intervalMinutes }: UptimeChartProps) {

  const drawChart = () => {
    if (latencyHistory.length === 0) {
      return (
        <div className="flex h-36 items-center justify-center text-slate-500 dark:text-slate-400 italic text-xs">
          No latency history recorded
        </div>
      )
    }

    const maxVal = Math.max(...latencyHistory, 120)
    const minVal = Math.min(...latencyHistory, 20)
    const height = 120
    const width = 450
    const padding = 15

    const points = latencyHistory.map((val, idx) => {
      const x = padding + (idx / (latencyHistory.length - 1 || 1)) * (width - padding * 2)
      const y = height - padding - ((val - minVal) / (maxVal - minVal || 1)) * (height - padding * 2)
      return { x, y, val }
    })

    const pathD = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">
          <span>Latency Trace</span>
          <span style={{ color: 'var(--color-blue)' }}>Peak: {maxVal}ms</span>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-color)" strokeOpacity="0.5" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="var(--border-color)" strokeOpacity="0.5" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" />

            {/* Trace Path */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-blue)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Nodes */}
            {points.map((p, idx) => (
              <circle key={idx} cx={p.x} cy={p.y} r="3.5" fill="var(--bg-card)" stroke="var(--color-blue)" strokeWidth="2" />
            ))}
          </svg>
        </div>

        {intervalMinutes !== undefined && (
          <div className="text-xs text-slate-400 dark:text-slate-500 italic">
            {latencyHistory.length} checks &middot; ~{intervalMinutes} min interval &middot; last ~{intervalMinutes * latencyHistory.length} min
          </div>
        )}
      </div>
    )
  }

  const statusMeta = status === 'success'
    ? { tone: 'ok' as const, label: 'Reachable', Icon: ShieldCheck }
    : status === 'error'
    ? { tone: 'crit' as const, label: 'Unreachable', Icon: ShieldX }
    : { tone: 'neutral' as const, label: 'Awaiting first check', Icon: ShieldQuestion }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
      {/* Sparkline Latency Trace */}
      <div className="md:col-span-2 p-5 rounded-2xl border" style={{ background: 'var(--well)', borderColor: 'var(--border-color)' }}>
        {drawChart()}
      </div>

      {/* Current status — reflects the most recent check only; there is no time-bounded
          success ratio stored yet, so this deliberately doesn't invent a fake percentage */}
      <div className="p-5 rounded-2xl border flex flex-col justify-center gap-3" style={{ background: 'var(--well)', borderColor: 'var(--border-color)' }}>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Current Status</span>
        <div className="flex items-center gap-2">
          <statusMeta.Icon className="w-5 h-5 shrink-0" style={{ color: `var(${statusMeta.tone === 'ok' ? '--color-green' : statusMeta.tone === 'crit' ? '--color-red' : '--text-secondary'})` }} />
          <Pill tone={statusMeta.tone}>{statusMeta.label}</Pill>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">Based on the most recent check.</p>
      </div>
    </div>
  )
}
export default UptimeChart
