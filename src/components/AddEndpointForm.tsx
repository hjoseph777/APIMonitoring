import React, { useState, useRef, useEffect } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { AuthConfigurator } from './auth/AuthConfigurator'

interface AddEndpointFormProps {
  onAdd: (endpoint: { name: string; url: string; interval: number; authType: string; authConfig: any }) => Promise<void>
}

export function AddEndpointForm({ onAdd }: AddEndpointFormProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval] = useState(5)
  const [authType, setAuthType] = useState('none')
  const [authConfig, setAuthConfig] = useState<any>({ type: 'none' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

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
        authConfig
      })
      // Clear form
      setName('')
      setUrl('')
      setInterval(5)
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
    <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
        <Plus className="w-5 h-5 text-blue-500" />
        <h2 className="text-md font-bold text-white uppercase tracking-wider">Add New Endpoint</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Endpoint Name</label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Local ERP ERP_Sales"
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g., http://localhost:8080/api/sales"
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Check Interval (Minutes)</label>
          <input
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
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

      {error && <p className="text-xs text-rose-500 font-semibold">{error}</p>}

      <div className="flex justify-end pt-3 border-t border-slate-800/80">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
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
