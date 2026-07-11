import type { Endpoint } from '../types'

export interface FleetStats {
  total: number
  online: number
  down: number
  degraded: number
  avgResponseMs: number | null
  /** online / total right now — an honest instantaneous proxy, not a time-bounded uptime % */
  fleetHealthPct: number | null
}

const DEFAULT_DEGRADED_MS = 500

// Shared by Dashboard and Reports so the two screens can't drift into disagreeing numbers.
export function computeFleetStats(endpoints: Endpoint[]): FleetStats {
  let online = 0
  let down = 0
  let degraded = 0
  let responseSum = 0
  let responseCount = 0

  for (const ep of endpoints) {
    const latest = ep.responseTimeHistory && ep.responseTimeHistory.length > 0
      ? ep.responseTimeHistory[ep.responseTimeHistory.length - 1]
      : undefined
    const degradedMs = ep.degradedMs ?? DEFAULT_DEGRADED_MS

    if (ep.status === 'error') {
      down++
    } else if (ep.status === 'success') {
      if (latest !== undefined && latest > degradedMs) {
        degraded++
      } else {
        online++
      }
    }

    if (latest !== undefined) {
      responseSum += latest
      responseCount++
    }
  }

  const total = endpoints.length
  return {
    total,
    online,
    down,
    degraded,
    avgResponseMs: responseCount > 0 ? Math.round(responseSum / responseCount) : null,
    fleetHealthPct: total > 0 ? Math.round((online / total) * 1000) / 10 : null
  }
}

export type Tone = 'ok' | 'warn' | 'crit' | 'neutral'

// Driven by down/degraded counts rather than banding the raw ratio — a single outage in a
// small fleet shouldn't read as identical to a genuinely degraded majority.
export function fleetHealthTone(stats: FleetStats): Tone {
  if (stats.down > 0) return 'crit'
  if (stats.degraded > 0) return 'warn'
  return 'ok'
}

// degradedMs defaults to the global 500ms fallback for aggregate/fleet-wide values
// that aren't tied to one endpoint's configured threshold.
export function responseTone(ms: number | null, degradedMs: number = DEFAULT_DEGRADED_MS): Tone {
  if (ms === null) return 'neutral'
  if (ms < degradedMs * 0.4) return 'ok'
  if (ms <= degradedMs) return 'warn'
  return 'crit'
}
