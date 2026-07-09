import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Endpoint } from '../types'
import AddEndpointForm from './AddEndpointForm'

import { useMonitoringStore } from '../store/monitoringStore'

export function Settings() {
  const endpoints = useMonitoringStore(state => state.endpoints)
  const onAdd = useMonitoringStore(state => state.addEndpoint)
  const onDelete = useMonitoringStore(state => state.deleteEndpoint)

  const [alertThreshold, setAlertThreshold] = useState('2')
  const [autoStart, setAutoStart] = useState(true)
  const [minimizeTray, setMinimizeTray] = useState(true)

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">

      {/* Endpoint Management - Form renders directly without wrapper (has its own header) */}
      <AddEndpointForm onAdd={onAdd} />

      {/* Endpoint List with discrete rows matching mockup */}
      <div className="glass-panel dark:bg-[#2a2d3d] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 dark:shadow-lg dark:pb-4">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-100/50 dark:bg-[#4a5f82] dark:border-slate-700/50">
          <h2 className="text-xs dark:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#6ba4f8]">
            Monitored Links
          </h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-y-0 dark:space-y-3 dark:px-4 dark:pt-4">
          {endpoints.map((ep) => (
            <div key={ep.id} className="p-4 dark:p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-[#383a48] dark:bg-[#383a48] dark:border-l-4 dark:border-rose-500 dark:rounded-md transition-colors relative">
              <div className="truncate pr-4 dark:space-y-0.5">
                <div className="font-bold text-slate-700 dark:text-slate-300">{ep.name}</div>
                <div className="text-[10px] dark:text-[12px] text-slate-500 dark:text-white font-mono truncate">{ep.url}</div>
              </div>
              <div className="flex items-center gap-4 dark:absolute dark:right-4 dark:top-1/2 dark:-translate-y-1/2">
                <span className="hidden dark:inline text-[11px] text-slate-400 font-mono">
                  {ep.lastCheck ? new Date(ep.lastCheck).toLocaleTimeString() : '9:35:58 AM'}
                </span>
                <button
                  onClick={() => onDelete(ep.id)}
                  className="p-2 dark:p-1.5 hover:bg-rose-50 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 dark:hover:text-slate-300 dark:text-slate-300 rounded-lg transition-all"
                  title="Remove endpoint"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {endpoints.length === 0 && (
            <div className="p-8 dark:p-4 text-center text-slate-400 italic dark:bg-[#383a48] dark:rounded-md">No registered endpoints. Use the form above to add one.</div>
          )}
        </div>
      </div>

      {/* Background Engine — compact single row */}
      <div className="glass-panel px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/10">
        <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
          Background Engine
        </h3>
        <div className="flex flex-wrap items-end gap-6">

          {/* Failure Threshold dropdown */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-200">
              Consecutive Failure Threshold
            </label>
            <select
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400 cursor-pointer"
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
