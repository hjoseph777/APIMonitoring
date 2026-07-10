import React from 'react'

interface PanelProps {
  title?: string
  right?: React.ReactNode
  danger?: boolean
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}

// Shared card+header shell — extracted from the panel markup that Dashboard,
// Settings, and NotificationJson each repeated with slightly different classes.
export function Panel({ title, right, danger = false, children, className = '', bodyClassName = '' }: PanelProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden border bg-[var(--bg-card)] shadow-sm dark:shadow-lg ${
        danger ? 'border-rose-500/40' : 'border-[var(--border-color)]'
      } ${className}`}
    >
      {title && (
        <div
          className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${
            danger ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-100 dark:bg-[#4a5f82] border-[var(--border-color)]'
          }`}
        >
          <h3 className={`text-xs font-bold uppercase tracking-wider ${danger ? 'text-rose-500' : 'text-blue-600 dark:text-[#6ba4f8]'}`}>
            {title}
          </h3>
          {right}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

export default Panel
