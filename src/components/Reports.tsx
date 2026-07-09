import React from 'react'
import { Endpoint } from '../types'
import { UptimeChart } from './ui/UptimeChart'
import { BarChart3 } from 'lucide-react'

interface ReportsProps {
  endpoints: Endpoint[]
}

export function Reports({ endpoints }: ReportsProps) {
  return (
    <div className="space-y-6">
      {endpoints.map((ep) => (
        <div key={ep.id} className="glass-panel p-5 rounded-xl border space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">{ep.name}</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-300 font-mono select-text">{ep.url}</p>
            </div>
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300 text-[10px]">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>10-Point Trace</span>
            </div>
          </div>

          <UptimeChart latencyHistory={ep.responseTimeHistory} status={ep.status} />
        </div>
      ))}
      
      {endpoints.length === 0 && (
        <div className="glass-panel p-8 rounded-xl border text-center text-xs text-slate-400 dark:text-slate-300 italic">
          No metrics available. Register endpoints in Settings to display reports.
        </div>
      )}
    </div>
  )
}
export default Reports
