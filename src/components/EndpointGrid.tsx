import React, { useState, useMemo } from 'react'
import { Search, Filter, AlertCircle, FilePlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Endpoint } from '../types'
import { EndpointCard } from './EndpointCard'

interface EndpointGridProps {
  endpoints: Endpoint[]
  onRefresh: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  loading?: boolean
}

export function EndpointGrid({ endpoints, onRefresh, onDelete, loading = false }: EndpointGridProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'idle'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Filtering, searching, sorting logic
  const filteredAndSortedEndpoints = useMemo(() => {
    let result = [...endpoints]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
      )
    }

    // Filter
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter)
    }

    // Sorting: errors first, then idle, then success
    result.sort((a, b) => {
      const statusWeight = { error: 0, idle: 1, success: 2 }
      return statusWeight[a.status] - statusWeight[b.status]
    })

    return result
  }, [endpoints, search, statusFilter])

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedEndpoints.length / itemsPerPage)
  const paginatedEndpoints = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedEndpoints.slice(start, start + itemsPerPage)
  }, [filteredAndSortedEndpoints, currentPage])

  // Reset page when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  const renderSkeletons = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl h-24 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-800 rounded" />
                <div className="h-3 w-48 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="w-12 h-6 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const renderEmptyState = () => {
    return (
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
            d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="text-sm font-bold text-white mb-1">No Endpoints Registered</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          Get started by adding an ERP connection endpoint in the form above.
        </p>
      </div>
    )
  }

  if (loading) return renderSkeletons()

  return (
    <div className="space-y-6">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="success">Online Only</option>
            <option value="error">Offline Only</option>
            <option value="idle">Idle Only</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {paginatedEndpoints.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {paginatedEndpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              onRefresh={onRefresh}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-xs">
          <span className="text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredAndSortedEndpoints.length)} of{' '}
            {filteredAndSortedEndpoints.length} endpoints
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-slate-300 font-semibold">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default EndpointGrid

