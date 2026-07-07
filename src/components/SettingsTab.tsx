import React, { useState } from 'react'
import { Download, Upload, ShieldAlert, CheckCircle, RefreshCcw, Mail, Webhook, Trash2 } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useMonitoringContext } from '../context/MonitoringContext'

export function SettingsTab() {
  const { addToast } = useToast()
  const { refetchData } = useMonitoringContext()
  const [smtpServer, setSmtpServer] = useState('smtp.company.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('alerts@company.com')
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
        addToast('Backup exported successfully.', 'success')
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
          addToast('Database backup imported successfully!', 'success')
          await refetchData()
        } else {
          addToast('Invalid backup file schema.', 'error')
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
    <div className="space-y-6">
      {/* Backup and Restore */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800/60 pb-2">
          Backup & Restore Configurations
        </h2>
        <p className="text-xs text-slate-400">
          Save your endpoints settings, auth rules, alerts history, and copy audits locally to a backup file, or restore them anytime.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-blue-400" />
            Export Backup JSON
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-emerald-400" />
            Import Backup JSON
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* SMTP Email Configurations */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800/60 pb-2">
          SMTP Mail Configurations (Simulated)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">SMTP Server</label>
            <input
              type="text"
              value={smtpServer}
              onChange={(e) => setSmtpServer(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">SMTP Port</label>
            <input
              type="text"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Sender Email</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800/60 pb-2">
          Global Notification Webhooks
        </h2>
        <div className="text-xs space-y-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Discord / Slack Webhook URL</label>
            <input
              type="text"
              value={globalWebhook}
              onChange={(e) => setGlobalWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              If configured, failures will trigger real-time JSON alert dispatches.
            </p>
          </div>
        </div>
      </div>

      {/* Database Reset */}
      <div className="glass-panel p-6 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-4">
        <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider border-b border-red-500/10 pb-2">
          Danger Zone
        </h2>
        <p className="text-xs text-slate-400">
          This operation will clear all configurations, logs, and alerts permanently.
        </p>

        {resetConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-red-400 font-semibold">Are you absolutely sure?</span>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setResetConfirm(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setResetConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Reset All Database Data
          </button>
        )}
      </div>
    </div>
  )
}
export default SettingsTab

