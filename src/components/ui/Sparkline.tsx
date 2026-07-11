export type SparklineTone = 'ok' | 'warn' | 'crit' | 'neutral'

const TONE_VAR: Record<SparklineTone, string> = {
  ok: '--color-green',
  warn: '--color-orange',
  crit: '--color-red',
  neutral: '--text-secondary'
}

interface SparklineProps {
  history?: number[]
  tone: SparklineTone
  width?: number
  height?: number
}

export function Sparkline({ history, tone, width = 46, height = 18 }: SparklineProps) {
  if (!history || history.length < 2) return <span style={{ width }} className="shrink-0 inline-block" />
  const max = Math.max(...history)
  const min = Math.min(...history)
  const range = max - min || 1
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={`var(${TONE_VAR[tone]})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default Sparkline
