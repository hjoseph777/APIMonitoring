import React from 'react'

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon: Icon, title, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center gap-1.5 ${className}`}>
      {Icon && <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 italic">{title}</span>
      {description && <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>}
    </div>
  )
}

export default EmptyState
