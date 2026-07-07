import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Endpoint } from '../types'
import AddEndpointForm from './AddEndpointForm'

interface SettingsProps {
  endpoints: Endpoint[]
  onAdd: (newEp: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function Settings({ endpoints, onAdd, onDelete }: SettingsProps) {
  const [alertThreshold, setAlertThreshold] = useState('2')
  const [autoStart, setAutoStart] = useState(true)
  const [minimizeTray, setMinimizeTray] = useState(true)

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">
      
      {/* Endpoint Management - Form renders directly without wrapper (has its own header) */}
      <AddEndpointForm onAdd={onAdd} />
        
      {/* Endpoint List with inline deletes */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-100/50 dark:bg-slate-900/20 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-300">
          Monitored Links
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white/10 dark:bg-slate-900/5">
          {endpoints.map((ep) => (
            <div key={ep.id} className="p-3 flex items-center justify-between hover:bg-slate-100/35 dark:hover:bg-slate-900/20">
              <div className="truncate pr-4">
                <div className="font-semibold text-slate-800 dark:text-slate-200">{ep.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{ep.url}</div>
              </div>
              <button
                onClick={() => onDelete(ep.id)}
                className="p-1.5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 border border-transparent rounded-lg transition-all"
                title="Remove endpoint"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {endpoints.length === 0 && (
            <div className="p-4 text-center text-slate-400 dark:text-slate-500 italic">No registered endpoints. Use the form above to add one.</div>
          )}
        </div>
      </div>

      {/* Background Engine — compact single row */}
      <div className="glass-panel px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/10">
        <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
          Background Engine
        </h3>
        <div className="flex flex-wrap items-end gap-6">
          
          {/* Failure Threshold dropdown */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Consecutive Failure Threshold
            </label>
            <select
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="1">Alert after 1 failure</option>
              <option value="2">Alert after 2 failures</option>
              <option value="3">Alert after 3 failures</option>
              <option value="5">Alert after 5 failures</option>
              <option value="10">Alert after 10 failures</option>
            </select>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-10 bg-slate-200 dark:bg-slate-800 self-center" />

          {/* System checkboxes inline */}
          <div className="flex flex-wrap items-center gap-5 pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="w-4 h-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 cursor-pointer"
              />
              <span className="text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Auto-start with System tray
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={minimizeTray}
                onChange={(e) => setMinimizeTray(e.target.checked)}
                className="w-4 h-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 cursor-pointer"
              />
              <span className="text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Minimize to tray on close
              </span>
            </label>
          </div>

        </div>
      </div>

    </div>
  )
}


export default Settings

