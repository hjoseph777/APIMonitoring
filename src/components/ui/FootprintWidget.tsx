import { useEffect, useState } from 'react'
import { Pill } from './Pill'
import { Sparkline } from './Sparkline'
import type { FootprintSnapshot } from '../../types'

const SUSTAINED_SAMPLE_COUNT = 30 // 5 min at a 10s sample rate
const CPU_AMBER_THRESHOLD = 10
const RAM_AMBER_THRESHOLD_MB = 500

export function FootprintWidget() {
  const [snapshot, setSnapshot] = useState<FootprintSnapshot | null>(null)

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getFootprint().then(setSnapshot)
    const listener = window.electronAPI.onFootprintUpdate(setSnapshot)
    return () => window.electronAPI.offFootprintUpdate(listener)
  }, [])

  if (!snapshot) return null

  const recent = snapshot.history.slice(-SUSTAINED_SAMPLE_COUNT)
  const sustained = recent.length >= SUSTAINED_SAMPLE_COUNT
  const avgCpu = recent.length > 0 ? recent.reduce((sum, s) => sum + s.cpuPercent, 0) / recent.length : 0
  const avgRam = recent.length > 0 ? recent.reduce((sum, s) => sum + s.ramMB, 0) / recent.length : 0
  const isHot = sustained && (avgCpu > CPU_AMBER_THRESHOLD || avgRam > RAM_AMBER_THRESHOLD_MB)

  const historyMs = snapshot.history.map((s) => s.ramMB)

  return (
    <div className="relative group flex items-center gap-2">
      <Pill tone={isHot ? 'warn' : 'ok'} dot>
        CPU {snapshot.cpuPercent.toFixed(1)}% &middot; RAM {snapshot.ramMB.toFixed(0)} MB
      </Pill>
      <Sparkline history={historyMs} tone={isHot ? 'warn' : 'ok'} width={40} height={14} />

      {snapshot.processes.length > 0 && (
        <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Per-process footprint</div>
          <div className="space-y-1">
            {snapshot.processes.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="capitalize">{p.type}</span>
                <span className="font-mono">{p.cpuPercent.toFixed(1)}% &middot; {p.ramMB.toFixed(0)} MB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FootprintWidget
