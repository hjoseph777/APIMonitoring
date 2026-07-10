import type { Endpoint } from '../../types'

const LABELS: Record<Endpoint['authType'], string> = {
  none: 'No Auth',
  apiKey: 'API Key',
  ntlm: 'NTLM',
  certificate: 'Certificate',
  oauth2: 'OAuth2',
  basic: 'Basic',
  cookie: 'Cookie'
}

// Most auth types share the primary accent; a couple get purple so a scanning eye
// can spot "delegated/session" auth (OAuth2, cookie) apart from static credentials.
const COLOR_VAR: Partial<Record<Endpoint['authType'], string>> = {
  oauth2: '--color-purple',
  cookie: '--color-purple'
}

interface AuthTagProps {
  authType: Endpoint['authType']
  className?: string
}

export function AuthTag({ authType, className = '' }: AuthTagProps) {
  if (authType === 'none') return null
  const colorVar = COLOR_VAR[authType] ?? '--color-blue'
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap tracking-wide ${className}`}
      style={{
        background: `color-mix(in srgb, var(${colorVar}) 14%, transparent)`,
        color: `var(${colorVar})`
      }}
    >
      {LABELS[authType]}
    </span>
  )
}

export default AuthTag
