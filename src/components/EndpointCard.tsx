import React, { useState } from 'react'
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Clock, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react'
import { Endpoint } from '../types'
import { UptimeChart } from './ui/UptimeChart'

interface EndpointCardProps {
  endpoint: Endpoint
  onRefresh: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function EndpointCard({ endpoint, onRefresh, onDelete }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const getBorderColor = () => {
    switch (endpoint.status) {
      case 'success':
        return 'border-l-green-500'
      case 'error':
        return 'border-l-red-500'
      case 'idle':
      default:
        return 'border-l-slate-600'
    }
  }

  const getStatusDotColor = () => {
    switch (endpoint.status) {
      case 'success':
        return 'bg-green-500 shadow-green-500/50'
      case 'error':
        return 'bg-red-500 shadow-red-500/50 animate-pulse'
      case 'idle':
      default:
        return 'bg-slate-400'
    }
  }

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRefreshing(true)
    try {
      await onRefresh(endpoint.id)
    } finally {
      setRefreshing(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  // Generate mini SVG sparkline representing response times
  const renderSparkline = () => {
    const times = endpoint.responseTimeHistory || []
    if (times.length === 0) return <span className="text-slate-600 text-xs italic">No check history</span>

    const max = Math.max(...times, 100)
    const width = 100
    const height = 24
    const points = times
      .map((val, idx) => {
        const x = (idx / (times.length - 1 || 1)) * width
        const y = height - (val / max) * height + 2
        return `${x},${y}`
      })
      .join(' ')

    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 font-medium">Latencies:</span>
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            points={points}
          />
        </svg>
        <span className="text-[10px] text-blue-400 font-bold">{times[times.length - 1]}ms</span>
      </div>
    )
  }

  return (
    <div className={`glass-card rounded-2xl border border-slate-800/80 border-l-4 ${getBorderColor()} overflow-hidden`}>
      {/* Top Header Section */}
      <div
        className="p-5 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shadow-sm ${getStatusDotColor()}`} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{endpoint.name}</h3>
            <p className="text-xs text-slate-500 truncate max-w-[250px] md:max-w-[400px]">
              {endpoint.url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{endpoint.interval}m</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Refresh button */}
            <button
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 border border-slate-800/60 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Delete button */}
            <button
              onClick={handleDeleteClick}
              className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900/50 hover:bg-rose-950/20 border border-slate-800/60 rounded-lg transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800 pt-4 bg-slate-900/10 space-y-4 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-slate-500 block">Full URL:</span>
              <span className="text-slate-300 select-text break-all">{endpoint.url}</span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 block">Monitoring Status:</span>
              <div className="flex items-center gap-1.5 font-semibold">
                {endpoint.status === 'success' && <span className="text-green-400">✓ Active & Reachable</span>}
                {endpoint.status === 'error' && <span className="text-red-400">✗ Connection Failure</span>}
                {endpoint.status === 'idle' && <span className="text-slate-400">Idle (Not checked yet)</span>}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 block">Authentication:</span>
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span className="capitalize">{endpoint.authType === 'none' ? 'Public' : endpoint.authType}</span>
              </div>
            </div>
          </div>

          {/* Stats details & sparkline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-900/35 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Consecutive Errors</span>
                <span className={`text-sm font-bold ${endpoint.consecutiveErrors > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                  {endpoint.consecutiveErrors}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Total Errors</span>
                <span className="text-sm font-bold text-slate-300">{endpoint.errorCount}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Last Checked</span>
                <span className="text-xs text-slate-300 font-mono">
                  {endpoint.lastCheck ? new Date(endpoint.lastCheck).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            {/* Sparkline charts */}
            <div className="flex justify-end">{renderSparkline()}</div>
          </div>
          
          {/* Detailed latency SVG line chart and health quotient */}
          <UptimeChart latencyHistory={endpoint.responseTimeHistory} status={endpoint.status} />
        </div>
      )}

      {/* Delete confirmation dialog modal portal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-sm font-bold text-white">Delete Endpoint?</h4>
            </div>
            <p className="text-xs text-slate-400">
              Are you sure you want to stop monitoring **{endpoint.name}**? This will delete all configuration settings and logs.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDeleteConfirm(false)
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  await onDelete(endpoint.id)
                  setShowDeleteConfirm(false)
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-semibold text-white transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default EndpointCard
