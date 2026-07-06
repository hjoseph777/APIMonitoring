import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rect' | 'circle'
}

export function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'circle':
        return 'rounded-full'
      case 'text':
        return 'rounded h-3 w-full'
      case 'rect':
      default:
        return 'rounded-xl'
    }
  }

  return (
    <div className={`bg-slate-900/80 border border-slate-800/40 animate-pulse ${getVariantStyle()} ${className}`} />
  )
}
export default Skeleton
