import React, { useState } from 'react'
import { Download, Upload, Mail, Webhook, Cpu } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useMonitoringContext } from '../context/MonitoringContext'

export function NotificationJson() {
  const { addToast } = useToast()
  const { refetchData } = useMonitoringContext()

  // Option states
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
                className="w-full bg-slate-105 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 dark:bg-slate-900"
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
                placeholder="admin@company.com, alerts@company.com"
                className="w-full bg-slate-105 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 dark:bg-slate-900"
              />
            </div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">Separate multiple addresses with commas</span>
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1 font-mono">Chat Webhook URL (MS Teams / Discord / Slack)</label>
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-slate-455 shrink-0" />
              <input
                type="text"
                value={globalWebhook}
                onChange={(e) => setGlobalWebhook(e.target.value)}
                placeholder="https://outlook.office.com/... or https://discord.com/..."
                className="w-full bg-slate-105 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 dark:bg-slate-900"
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
              className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800"
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-305 rounded-lg font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Export Backup JSON
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-305 rounded-lg font-semibold cursor-pointer transition-all">
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
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-all cursor-pointer"
              >
                Yes, Wipe All Data
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="px-3 py-1.5 bg-slate-250 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setResetConfirm(true)}
              className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 rounded-lg font-semibold transition-all cursor-pointer"
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
    <div className="glass-panel p-4.5 rounded-xl border space-y-3.5 bg-white/20 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
        {title}
      </h3>
      {children}
    </div>
  )
}

export default NotificationJson
