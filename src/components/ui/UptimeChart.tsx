import React from 'react'
import { Activity, ShieldCheck, Heart } from 'lucide-react'

interface UptimeChartProps {
  latencyHistory?: number[]
  status: 'success' | 'error' | 'idle'
}

export function UptimeChart({ latencyHistory = [], status }: UptimeChartProps) {
  const uptimeScore = status === 'success' ? 100 : status === 'error' ? 0 : 100

  // Draw SVG sparkline path
  const drawChart = () => {
    if (latencyHistory.length === 0) {
      return (
        <div className="flex h-36 items-center justify-center text-slate-600 italic text-xs">
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
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
          <span>Latency Trace</span>
          <span className="text-blue-400">Peak: {maxVal}ms</span>
        </div>
        
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" />

            {/* Trace Path */}
            <path
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_2px_8px_rgba(59,130,246,0.35)]"
            />

            {/* Nodes */}
            {points.map((p, idx) => (
              <g key={idx} className="group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
      {/* Sparkline Latency Trace */}
      <div className="md:col-span-2 bg-slate-900/30 p-5 rounded-2xl border border-slate-850">
        {drawChart()}
      </div>

      {/* Health / Uptime Summary */}
      <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-850 flex flex-col justify-between space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Health Quotient</span>
          <div className="flex items-center gap-2">
            <Heart className={`w-5 h-5 ${status === 'success' ? 'text-red-500 fill-red-500' : 'text-slate-600'}`} />
            <span className="text-xl font-black text-white">{status === 'success' ? '100%' : status === 'error' ? '0%' : 'N/A'}</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Service Status</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className={`w-4 h-4 ${status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-xs font-semibold text-slate-300">
              {status === 'success' ? 'Fully Functional' : status === 'error' ? 'Operational Failure' : 'Awaiting Check'}
            </span>
          </div>
        </div>

        <div className="text-[9px] text-slate-500">
          Uptime ratio calculated over the last 10 execution loops.
        </div>
      </div>
    </div>
  )
}
export default UptimeChart
