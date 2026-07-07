import React, { useState, useMemo } from 'react'
import { Search, Trash2, Copy, Check, Download, AlertTriangle, FileSpreadsheet, Code } from 'lucide-react'
import { Log } from '../types'
import { useToast } from '../context/ToastContext'

interface XeroxLogsProps {
  logs: Log[]
  onClearLogs: () => void
}

export function XeroxLogs({ logs, onClearLogs }: XeroxLogsProps) {
  const [search, setSearch] = useState('')
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
  const { addToast } = useToast()

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    let xeroxLogs = logs.filter((log) => log.type === 'xerox')
    if (search.trim()) {
      const q = search.toLowerCase()
      xeroxLogs = xeroxLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(q) ||
          log.endpointName?.toLowerCase().includes(q)
      )
    }
    // Newest logs first
    return xeroxLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [logs, search])

  // Copy specific log message to clipboard
  const handleCopyText = async (text: string, logId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.copyToClipboard(text)
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopiedLogId(logId)
      addToast('Payload copied to clipboard!', 'success')
      setTimeout(() => setCopiedLogId(null), 2000)
    } catch (err) {
      addToast('Failed copying to clipboard', 'error')
    }
  }

  // Export logs as JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `xerox_logs_${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Export logs as CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Endpoint', 'Message', 'Status']
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.endpointName || 'System',
      l.message.replace(/"/g, '""'),
      l.success ? 'Success' : 'Failed'
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((val) => `"${val}"`).join(','))].join('\n')

    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', encodeURI(csvContent))
    downloadAnchor.setAttribute('download', `xerox_logs_${Date.now()}.csv`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/10 border border-slate-800 rounded-2xl">
      <svg
        className="w-16 h-16 text-slate-700 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
        />
      </svg>
      <h3 className="text-sm font-bold text-white mb-1">No Xerox Logs</h3>
      <p className="text-xs text-slate-500 max-w-sm">
        Copy actions and clipboard logging details will list here once endpoints are monitored.
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clipboard logs..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
          />
        </div>

        {filteredLogs.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
              title="Export as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
              title="Export as JSON"
            >
              <Code className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 bg-red-500/10 hover:bg-red-500/25 rounded-lg text-xs font-semibold text-red-400 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </button>
          </div>
        )}
      </div>

      {filteredLogs.length === 0 ? (
        renderEmptyState()
      ) : (
        /* Logs table list */
        <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/35 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Endpoint</th>
                  <th className="p-4">Message / Event</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                    <td className="p-4 text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 font-bold text-slate-300">
                      {log.endpointName || 'System'}
                    </td>
                    <td className="p-4 text-slate-400 max-w-[300px] truncate select-text" title={log.message}>
                      {log.message}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.success
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleCopyText(log.message, log.id)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all inline-flex items-center"
                        title="Copy to Clipboard"
                      >
                        {copiedLogId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
export default XeroxLogs


