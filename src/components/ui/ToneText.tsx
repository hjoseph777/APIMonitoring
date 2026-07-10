import React from 'react'
import type { Tone } from '../../lib/fleetStats'

const TONE_VAR: Record<Tone, string> = {
  ok: '--color-green',
  warn: '--color-orange',
  crit: '--color-red',
  neutral: '--text-secondary'
}

interface ToneTextProps {
  tone: Tone
  children: React.ReactNode
}

// Inline colored value, e.g. "184ms" or "98.2%", tinted by a fleetStats Tone
export function ToneText({ tone, children }: ToneTextProps) {
  return (
    <b className="font-mono font-bold" style={{ color: `var(${TONE_VAR[tone]})` }}>
      {children}
    </b>
  )
}

export default ToneText
