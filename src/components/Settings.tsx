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
  // Simulated option states
  const [defaultInterval, setDefaultInterval] = useState('5')
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

      {/* Monitoring Settings */}
      <SettingsSection title="Background Engine">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1.5">Default Check Interval</label>
            <select
              value={defaultInterval}
              onChange={(e) => setDefaultInterval(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="1">Every 1 minute</option>
              <option value="2">Every 2 minutes</option>
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1.5">Consecutive Failure Threshold</label>
            <select
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="1">1 check</option>
              <option value="2">2 checks</option>
              <option value="3">3 checks</option>
              <option value="5">5 checks</option>
              <option value="10">10 checks</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
            />
            <span className="text-slate-600 dark:text-slate-300">Auto-start with Windows System tray</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={minimizeTray}
              onChange={(e) => setMinimizeTray(e.target.checked)}
              className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
            />
            <span className="text-slate-600 dark:text-slate-300">Minimize window to System tray on close</span>
          </label>
        </div>
      </SettingsSection>

    </div>
  )
}

/* Helper settings wrapper section widget */
interface SettingsSectionProps {
  title: string
  children: React.ReactNode
}
function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="glass-panel p-4.5 rounded-xl border space-y-3.5 bg-white/20 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
        {title}
      </h3>
      {children}
    </div>
  )
}

export default Settings
