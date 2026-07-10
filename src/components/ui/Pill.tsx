import React from 'react'

export type PillTone = 'ok' | 'warn' | 'crit' | 'purple' | 'neutral'

const TONE_VAR: Record<PillTone, string> = {
  ok: '--color-green',
  warn: '--color-orange',
  crit: '--color-red',
  purple: '--color-purple',
  neutral: '--text-secondary'
}

interface PillProps {
  tone: PillTone
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function Pill({ tone, children, dot = false, className = '' }: PillProps) {
  const colorVar = TONE_VAR[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide whitespace-nowrap ${className}`}
      style={{
        background: `color-mix(in srgb, var(${colorVar}) 16%, transparent)`,
        color: `var(${colorVar})`
      }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: `var(${colorVar})` }} />}
      {children}
    </span>
  )
}

export default Pill
