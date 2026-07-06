import React, { useState } from 'react'
import { Trash2, Download, Upload, ShieldCheck, Mail, Webhook, Cpu } from 'lucide-react'
import { Endpoint } from '../types'
import AddEndpointForm from './AddEndpointForm'
import { useToast } from '../context/ToastContext'
import { useMonitoringContext } from '../context/MonitoringContext'

interface SettingsProps {
  endpoints: Endpoint[]
  onAdd: (newEp: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function Settings({ endpoints, onAdd, onDelete }: SettingsProps) {
  const { addToast } = useToast()
  const { refetchData } = useMonitoringContext()

  // Simulated option states
  const [defaultInterval, setDefaultInterval] = useState('5')
  const [alertThreshold, setAlertThreshold] = useState('2')
  const [autoStart, setAutoStart] = useState(true)
  const [minimizeTray, setMinimizeTray] = useState(true)
  const [nativeNotify, setNativeNotify] = useState(true)
  const [smtpServer, setSmtpServer] = useState('smtp.company.com')
  const [notifyEmail, setNotifyEmail] = useState('admin@company.com')
  const [globalWebhook, setGlobalWebhook] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)

  // Trigger export
  const handleExport = async () => {
    if (window.electronAPI) {
      try {
        const json = await window.electronAPI.exportBackup()
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(json)
        const downloadAnchor = document.createElement('a')
        downloadAnchor.setAttribute('href', dataStr)
        downloadAnchor.setAttribute('download', `api_monitor_backup_${Date.now()}.json`)
        document.body.appendChild(downloadAnchor)
        downloadAnchor.click()
        downloadAnchor.remove()
        addToast('Configurations exported successfully.', 'success')
      } catch (err: any) {
        addToast('Export failed: ' + err.message, 'error')
      }
    }
  }

  // Trigger import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !window.electronAPI) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const jsonString = event.target?.result as string
        const res = await window.electronAPI.importBackup(jsonString)
        if (res.success) {
          addToast('Database imported successfully!', 'success')
          await refetchData()
        } else {
          addToast('Invalid backup schema.', 'error')
        }
      } catch (err: any) {
        addToast('Import failed: ' + err.message, 'error')
      }
    }
    reader.readAsText(file)
  }

  // Trigger reset
  const handleReset = async () => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.resetAllData()
        addToast('All configurations and alerts reset.', 'info')
        await refetchData()
        setResetConfirm(false)
      } catch (err: any) {
        addToast('Reset failed: ' + err.message, 'error')
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">
      
      {/* Endpoint Management */}
      <SettingsSection title="Endpoint Registry">
        <AddEndpointForm onAdd={onAdd} />
        
        {/* Endpoint List with inline deletes */}
        <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-100/50 dark:bg-slate-900/20 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
            Monitored Links
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white/10 dark:bg-slate-900/5">
            {endpoints.map((ep) => (
              <div key={ep.id} className="p-3 flex items-center justify-between hover:bg-slate-100/35 dark:hover:bg-slate-900/20">
                <div className="truncate pr-4">
                  <div className="font-semibold text-slate-850 dark:text-slate-200">{ep.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{ep.url}</div>
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
              <div className="p-4 text-center text-slate-500 italic">No registered endpoints. Use the form above to add one.</div>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Monitoring Settings */}
      <SettingsSection title="Background Engine">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Default Check Interval</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={defaultInterval}
                onChange={(e) => setDefaultInterval(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              <span className="text-slate-400 font-semibold">minutes</span>
            </div>
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Consecutive Failure Threshold</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              <span className="text-slate-400 font-semibold">checks</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800"
            />
            <span className="text-slate-650 dark:text-slate-350">Auto-start with Windows System tray</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={minimizeTray}
              onChange={(e) => setMinimizeTray(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800"
            />
            <span className="text-slate-650 dark:text-slate-350">Minimize window to System tray on close</span>
          </label>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="System Notifications">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-500 font-semibold mb-1 font-mono">SMTP Simulated Server</label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-450 shrink-0" />
              <input
                type="text"
                value={smtpServer}
                onChange={(e) => setSmtpServer(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1 font-mono">Recipient Alert Emails</label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-450 shrink-0" />
              <input
                type="text"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="admin@company.com"
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1 font-mono">Discord / Webhook URL</label>
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-slate-455 shrink-0" />
              <input
                type="text"
                value={globalWebhook}
                onChange={(e) => setGlobalWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={nativeNotify}
              onChange={(e) => setNativeNotify(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800"
            />
            <span className="text-slate-650 dark:text-slate-350">Enable native OS toast banners</span>
          </label>
        </div>
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="Backup & Data Controls">
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Export Backup JSON
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            Import Backup JSON
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3">
          {resetConfirm ? (
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-rose-500">Confirm wiping database?</span>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-all"
              >
                Yes, Wipe All Data
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="px-3 py-1.5 bg-slate-250 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setResetConfirm(true)}
              className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 rounded-lg font-semibold transition-all"
            >
              Wipe Database Records
            </button>
          )}
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="System Info">
        <div className="flex items-center gap-4 text-slate-500 font-medium">
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Version: 1.0.0</span>
          </div>
          <span>•</span>
          <span>Engine: Electron + React + SQLite</span>
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
    <div className="glass-panel p-4.5 rounded-xl border space-y-3.5 bg-white/20 dark:bg-slate-900/10">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-350 border-b border-slate-200 dark:border-slate-800 pb-1.5">
        {title}
      </h3>
      {children}
    </div>
  )
}
export default Settings
