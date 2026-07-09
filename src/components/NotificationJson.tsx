import React, { useState, useEffect } from 'react'
import { Download, Upload, Mail, Webhook, Cpu, Send, AlertTriangle, Play, Trash2, ShieldAlert } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useMonitoringContext } from '../context/MonitoringContext'

export function NotificationJson() {
  const { addToast } = useToast()
  const { refetchData } = useMonitoringContext()

  // Option states
  const [nativeNotify, setNativeNotify] = useState(true)
  const [smtpServer, setSmtpServer] = useState('smtp.company.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('admin@company.com')
  const [globalWebhook, setGlobalWebhook] = useState('')
  const [globalWebhookChannel, setGlobalWebhookChannel] = useState('msteams')
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false)
  const [wipeConfirmInput, setWipeConfirmInput] = useState('')
  
  // Loading/testing states
  const [saving, setSaving] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      if (window.electronAPI && window.electronAPI.getSettings) {
        try {
          const settings = await window.electronAPI.getSettings()
          setNativeNotify(settings.nativeNotify)
          setSmtpServer(settings.smtpServer)
          setSmtpPort(settings.smtpPort || '587')
          setSmtpUser(settings.smtpUser || '')
          setSmtpPass(settings.smtpPass || '')
          setNotifyEmail(settings.notifyEmail)
          setGlobalWebhook(settings.globalWebhook)
          setGlobalWebhookChannel(settings.globalWebhookChannel || 'msteams')
        } catch (err: any) {
          console.error('Failed to load settings', err)
        }
      }
    }
    loadSettings()
  }, [])

  // Save settings
  const handleSaveSettings = async () => {
    if (!window.electronAPI || !window.electronAPI.saveSettings) return
    setSaving(true)
    try {
      await window.electronAPI.saveSettings({
        nativeNotify,
        smtpServer,
        smtpPort,
        smtpUser,
        smtpPass,
        notifyEmail,
        globalWebhook,
        globalWebhookChannel
      })
      addToast('System settings saved successfully.', 'success')
    } catch (err: any) {
      addToast('Failed to save settings: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Trigger test webhook
  const handleTestWebhook = async () => {
    if (!globalWebhook.trim()) {
      addToast('Please enter a webhook URL first.', 'error')
      return
    }
    setTestingWebhook(true)
    try {
      if (window.electronAPI && window.electronAPI.sendTestAlert) {
        const res = await window.electronAPI.sendTestAlert({
          webhookUrl: globalWebhook,
          channelType: globalWebhookChannel
        })
        if (res.success) {
          addToast('Simulated alert dispatched successfully!', 'success')
        } else {
          addToast('Webhook dispatch failed: ' + (res.message || 'Unknown error'), 'error')
        }
      } else {
        addToast('Mock webhook test complete.', 'info')
      }
    } catch (err: any) {
      addToast('Test failed: ' + err.message, 'error')
    } finally {
      setTestingWebhook(false)
    }
  }

  // Trigger test email
  const handleTestEmail = async () => {
    if (!smtpServer.trim() || !notifyEmail.trim()) {
      addToast('Please enter an SMTP Server and Recipient Email first.', 'error')
      return
    }
    setTestingEmail(true)
    try {
      if (window.electronAPI && window.electronAPI.sendTestEmail) {
        // Save the current config first so the backend can use it
        await window.electronAPI.saveSettings({
          nativeNotify,
          smtpServer,
          smtpPort,
          smtpUser,
          smtpPass,
          notifyEmail,
          globalWebhook,
          globalWebhookChannel
        })

        const res = await window.electronAPI.sendTestEmail()
        if (res.success) {
          addToast('Test email dispatched successfully!', 'success')
        } else {
          addToast('Email dispatch failed: ' + (res.message || 'Unknown error'), 'error')
        }
      } else {
        addToast('Mock email test complete.', 'info')
      }
    } catch (err: any) {
      addToast('Email test failed: ' + err.message, 'error')
    } finally {
      setTestingEmail(false)
    }
  }

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
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    try {
      const text = await file.text()
      if (window.electronAPI && window.electronAPI.importBackup) {
        const res = await window.electronAPI.importBackup(text)
        if (res.success) {
          addToast('Backup imported successfully! Pinging new endpoints.', 'success')
          refetchData()
        } else {
          addToast('Import failed: invalid backup file.', 'error')
        }
      }
    } catch (err: any) {
      addToast('Error reading file: ' + err.message, 'error')
    }
    e.target.value = ''
  }

  // Demonstration operations
  const handleSeedDemo = async (mode: 'green' | 'mixed') => {
    if (window.electronAPI && window.electronAPI.seedDemoData) {
      try {
        const res = await window.electronAPI.seedDemoData(mode)
        if (res.success) {
          addToast(`Seeded ${mode === 'mixed' ? 'mixed' : 'healthy'} demo endpoints. Pinging started!`, 'success')
          refetchData()
        } else {
          addToast('Failed to seed demo data: ' + res.message, 'error')
        }
      } catch (err: any) {
        addToast('Seed error: ' + err.message, 'error')
      }
    }
  }

  const handleClearDemo = async () => {
    if (window.electronAPI && window.electronAPI.clearDemoData) {
      try {
        const res = await window.electronAPI.clearDemoData()
        if (res.success) {
          addToast('Demonstration data cleared successfully.', 'info')
          refetchData()
        } else {
          addToast('Failed to clear demo data: ' + res.message, 'error')
        }
      } catch (err: any) {
        addToast('Clear error: ' + err.message, 'error')
      }
    }
  }

  // Wipe confirm
  const executeWipe = async () => {
    if (wipeConfirmInput !== 'RESET') return
    if (window.electronAPI && window.electronAPI.resetAllData) {
      try {
        await window.electronAPI.resetAllData()
        refetchData()
        addToast('All system records have been securely wiped.', 'success')
        setIsWipeModalOpen(false)
        setWipeConfirmInput('')
      } catch (err: any) {
        addToast('Reset failed: ' + err.message, 'error')
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">
      
      {/* Notifications */}
      <SettingsSection title="System Notifications">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">SMTP Server Host</label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">Port</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">SMTP Username</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">SMTP Password / App Password</label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">Recipient Alert Emails</label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="admin@company.com, alerts@company.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail || !smtpServer || !notifyEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-primary)] hover:opacity-80 disabled:opacity-50 border border-[var(--border-color)] text-slate-700 dark:text-slate-200 rounded-lg font-bold transition-all shrink-0 cursor-pointer"
                title="Send test email"
              >
                <Send className="w-3.5 h-3.5" />
                Test
              </button>
            </div>
            <span className="text-[8px] text-slate-400 mt-1 block">Separate multiple addresses with commas</span>
          </div>

          <div className="border-t border-[var(--border-color)] pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">Channel Type</label>
              <select
                value={globalWebhookChannel}
                onChange={(e) => setGlobalWebhookChannel(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400 cursor-pointer"
              >
                <option value="msteams">MS Teams / Office 365</option>
                <option value="discord">Discord Webhook</option>
                <option value="slack">Slack Incoming</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[9px]">Chat Webhook URL</label>
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={globalWebhook}
                  onChange={(e) => setGlobalWebhook(e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !globalWebhook}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-primary)] hover:opacity-80 disabled:opacity-50 border border-[var(--border-color)] text-slate-700 dark:text-slate-200 rounded-lg font-bold transition-all shrink-0 cursor-pointer"
                  title="Send simulated test warning"
                >
                  <Send className="w-3.5 h-3.5" />
                  Test
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={nativeNotify}
                onChange={(e) => setNativeNotify(e.target.checked)}
                className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800"
              />
              <span className="text-slate-650 dark:text-slate-350 font-semibold">Enable native OS toast notifications</span>
            </label>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="Backup & Data Controls">
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-305 rounded-lg font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Export Backup JSON
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            Import Backup JSON
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3">
          <button
            onClick={() => setIsWipeModalOpen(true)}
            className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 rounded-lg font-semibold transition-all cursor-pointer"
          >
            Wipe Database Records
          </button>
        </div>
      </SettingsSection>

      {/* Demonstration Tools */}
      <SettingsSection title="Demonstration Tools">
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => handleSeedDemo('green')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg font-semibold transition-all cursor-pointer"
            title="Injects 4 100% online endpoints"
          >
            <Play className="w-3.5 h-3.5" />
            Seed Healthy (4)
          </button>

          <button
            onClick={() => handleSeedDemo('mixed')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg font-semibold transition-all cursor-pointer"
            title="Injects 2 online and 2 offline endpoints to trigger SMTP emails"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Seed Mixed (2 Good, 2 Err)
          </button>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3 mt-4">
          <button
            onClick={handleClearDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg font-semibold transition-all cursor-pointer"
            title="Remove all seed- prefixed demo data"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Seed Data
          </button>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="System Info">
        <div className="flex items-center gap-4 text-slate-400 dark:text-slate-300 font-medium">
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Version: 1.0.0 (v2.0 UI)</span>
          </div>
          <span>•</span>
          <span>Engine: Electron + React + SQLite</span>
        </div>
      </SettingsSection>

      {/* Safety Wiping Modal */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-extrabold text-sm uppercase tracking-wider">Destructive Operation</h4>
            </div>
            
            <p className="text-slate-400 dark:text-slate-300 leading-relaxed text-[11px] select-text">
              This action will permanently wipe all registered endpoints, stored alerts, and audit logs. This cannot be undone.
            </p>

            <div className="space-y-1.5">
              <label className="block text-[9px] uppercase font-bold text-slate-300">
                Type <span className="font-mono text-rose-500">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={wipeConfirmInput}
                onChange={(e) => setWipeConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-center text-xs tracking-widest text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setIsWipeModalOpen(false)
                  setWipeConfirmInput('')
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={wipeConfirmInput !== 'DELETE'}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/30 disabled:text-rose-400/40 text-white rounded-lg font-bold transition-all cursor-pointer"
              >
                Wipe Database
              </button>
            </div>
          </div>
        </div>
      )}

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
    <div className="glass-panel p-5 rounded-2xl border space-y-3.5 bg-white/20 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5">
        {title}
      </h3>
      {children}
    </div>
  )
}

export default NotificationJson
