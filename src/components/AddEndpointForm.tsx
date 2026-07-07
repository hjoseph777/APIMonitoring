import React, { useState, useRef, useEffect } from 'react'
import { Plus, Loader2, Play } from 'lucide-react'
import { AuthConfigurator } from './auth/AuthConfigurator'

interface AddEndpointFormProps {
  onAdd: (endpoint: { name: string; url: string; interval: number; authType: string; authConfig: any; timeout?: number }) => Promise<void>
}

export function AddEndpointForm({ onAdd }: AddEndpointFormProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval] = useState(5)
  const [timeoutVal, setTimeoutVal] = useState(10)
  const [authType, setAuthType] = useState('none')
  const [authConfig, setAuthConfig] = useState<any>({ type: 'none' })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  const handleTestConnection = async (e: React.MouseEvent) => {
    e.preventDefault()
    setError('')
    setTestResult(null)

    if (!url.trim()) {
      setError('URL is required to test connection')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('Please provide a valid absolute URL (e.g. http://127.0.0.1:8080/api)')
      return
    }

    setTesting(true)
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.testConnection({ url, authType, authConfig, timeout: timeoutVal })
        if (res.success) {
          setTestResult({ success: true, message: `Connected successfully! Status: ${res.status || 200}` })
        } else {
          setTestResult({ success: false, message: res.message || 'Connection failed.' })
        }
      } else {
        setTestResult({ success: true, message: 'Mock connection test passed (Browser environment).' })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Endpoint name is required')
      return
    }

    if (!url.trim()) {
      setError('URL is required')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('Please provide a valid absolute URL (e.g. http://127.0.0.1:8080/api)')
      return
    }

    if (interval < 1) {
      setError('Interval must be at least 1 minute')
      return
    }

    setLoading(true)
    try {
      await onAdd({
        name,
        url,
        interval,
        authType,
        authConfig,
        timeout: timeoutVal
      })
      // Clear form
      setName('')
      setUrl('')
      setInterval(5)
      setTimeoutVal(10)
      setAuthType('none')
      setAuthConfig({ type: 'none' })
      nameInputRef.current?.focus()
    } catch (err: any) {
      setError(err.message || 'Failed to add endpoint')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
        <Plus className="w-5 h-5 text-blue-500" />
        <h2 className="text-md font-bold text-slate-850 dark:text-white uppercase tracking-wider">Add New Endpoint</h2>
      </div>

      {/* Two Column Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Column 1: Endpoint Parameters */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Endpoint Name</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Local ERP ERP_Sales"
              disabled={loading}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g., http://localhost:8080/api/sales"
              disabled={loading}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Grid for check interval and custom timeouts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Check Interval (Min)</label>
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                disabled={loading}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Timeout (Sec)</label>
              <input
                type="number"
                min={1}
                value={timeoutVal}
                onChange={(e) => setTimeoutVal(parseInt(e.target.value) || 1)}
                disabled={loading}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Column 2: Authentication Configurations */}
        <div className="space-y-4">
          <AuthConfigurator
            type={authType}
            value={authConfig}
            onChange={({ type, config }) => {
              setAuthType(type)
              setAuthConfig(config)
            }}
          />
        </div>

      </div>

      {testResult && (
        <div className={`p-3 rounded-xl border text-xs font-semibold ${
          testResult.success 
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-450' 
            : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60 text-rose-600 dark:text-rose-450'
        }`}>
          {testResult.message}
        </div>
      )}

      {error && <p className="text-xs text-rose-500 font-semibold">{error}</p>}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={loading || testing}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-blue-500" />
              Test Connection
            </>
          )}
        </button>

        <button
          type="submit"
          disabled={loading || testing}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Endpoint
            </>
          )}
        </button>
      </div>
    </form>
  )
}
export default AddEndpointForm
