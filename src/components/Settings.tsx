import { useState, useEffect } from 'react'
import { Trash2, Pencil, ChevronRight, Plus, Check } from 'lucide-react'
import AddEndpointForm from './AddEndpointForm'
import { Panel } from './ui/Panel'
import { AuthTag } from './ui/AuthTag'
import { EmptyState } from './ui/EmptyState'
import { useToast } from '../context/ToastContext'

import { useMonitoringStore } from '../store/monitoringStore'

export function Settings() {
  const { addToast } = useToast()
  const endpoints = useMonitoringStore(state => state.endpoints)
  const onAdd = useMonitoringStore(state => state.addEndpoint)
  const onUpdate = useMonitoringStore(state => state.updateEndpoint)
  const onDelete = useMonitoringStore(state => state.deleteEndpoint)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const [alertThreshold, setAlertThreshold] = useState('2')
  const [autoStart, setAutoStart] = useState(false)
  const [minimizeTray, setMinimizeTray] = useState(true)
  const [saved, setSaved] = useState(false)

  // P16-5 & P16-12: load persisted values from the backend on mount
  useEffect(() => {
    if (window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then(s => {
        setAlertThreshold(String(s.alertThreshold ?? 2))
        setAutoStart(s.runAtStartup ?? false)
        setMinimizeTray(s.minimizeTray ?? true)
      }).catch(() => {})
    }
  }, [])

  const editingEndpoint = editingId ? endpoints.find(e => e.id === editingId) : undefined

  const handleAdd = async (data: Parameters<typeof onAdd>[0]) => {
    try {
      await onAdd(data)
      addToast(`Successfully registered ${data.name}!`, 'success')
      setFormOpen(false)
    } catch (err: any) {
      addToast(err.message || 'Failed to add endpoint', 'error')
      throw err
    }
  }

  const handleSaveEdit = async (data: any) => {
    if (!editingId) return
    try {
      await onUpdate(editingId, data)
      addToast(`Saved changes to ${data.name}.`, 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to save changes', 'error')
      throw err
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      await onDelete(id)
      addToast(`Removed endpoint ${name}.`, 'info')
      setConfirmingId(null)
    } catch {
      addToast('Failed to delete endpoint.', 'error')
    }
  }

  // P16-5: save threshold + auto-start to the backend
  async function handleSaveEngine() {
    if (!window.electronAPI?.getSettings || !window.electronAPI?.saveSettings) return
    try {
      const current = await window.electronAPI.getSettings()
      await window.electronAPI.saveSettings({
        ...current,
        alertThreshold: parseInt(alertThreshold, 10) || 2,
        runAtStartup: autoStart,
        minimizeTray
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      addToast('Failed to save engine settings.', 'error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">

      {/* Registered Endpoints leads the page — most visits are to review/manage, not register new */}
      <Panel title="Registered Endpoints" right={<span className="text-xs text-slate-500 dark:text-slate-400">{endpoints.length} total</span>}>
        <div className="divide-y divide-slate-100 dark:divide-y-0 dark:space-y-3 dark:px-4 dark:pt-4 dark:pb-4">
          {endpoints.map((ep) => (
            <div key={ep.id} className="p-4 dark:p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-[#383a48] dark:bg-[#383a48] dark:rounded-md transition-colors gap-3">
              <div className="truncate min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{ep.name}</span>
                  <AuthTag authType={ep.authType} />
                </div>
                <div className="text-xs text-slate-500 dark:text-white font-mono truncate">{ep.url}</div>
              </div>

              {confirmingId === ep.id ? (
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="text-rose-500 font-semibold hidden sm:inline">Remove {ep.name}?</span>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(ep.id, ep.name)}
                    className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="hidden md:inline text-xs text-slate-400 font-mono mr-2">
                    {ep.lastCheck ? new Date(ep.lastCheck).toLocaleTimeString() : 'Never checked'}
                  </span>
                  <button
                    onClick={() => { setEditingId(ep.id); setFormOpen(true) }}
                    className="p-2 dark:p-1.5 hover:bg-blue-50 dark:hover:bg-white/10 text-slate-400 hover:text-blue-500 dark:hover:text-slate-300 dark:text-slate-300 rounded-lg transition-all"
                    title="Edit endpoint"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmingId(ep.id)}
                    className="p-2 dark:p-1.5 hover:bg-rose-50 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 dark:hover:text-slate-300 dark:text-slate-300 rounded-lg transition-all"
                    title="Remove endpoint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {endpoints.length === 0 && (
            <EmptyState title="No registered endpoints" description="Use the form below to register your first one." />
          )}
        </div>
      </Panel>

      {/* Add / Edit form — collapsed by default so a returning visit isn't led with a big empty form */}
      {editingEndpoint ? (
        <AddEndpointForm
          key={editingEndpoint.id}
          mode="edit"
          initialEndpoint={editingEndpoint}
          onSubmit={handleSaveEdit}
          onCancel={() => setEditingId(null)}
        />
      ) : formOpen ? (
        <AddEndpointForm key="new" mode="add" onSubmit={handleAdd} onCancel={() => setFormOpen(false)} />
      ) : (
        <button
          onClick={() => setFormOpen(true)}
          className="w-full flex items-center gap-2 p-4 rounded-xl border border-dashed border-[var(--border-color)] text-slate-500 dark:text-slate-400 font-bold hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register New Endpoint
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      )}

      {/* Background Engine — compact single row */}
      <div className="glass-panel px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/10">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
          Background Engine
        </h3>
        <div className="flex flex-wrap items-end gap-6">

          {/* Failure Threshold dropdown */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-200">
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

          {/* Apply button — persists threshold and auto-start to the backend */}
          <div className="ml-auto flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                <Check className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            <button
              onClick={handleSaveEngine}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}
export default Settings
