// Pure backup-payload validation — no Electron/DB imports, so this can be unit
// tested directly. Only checks shape; importBackup in database.ts owns the
// actual restore side effects.

const VALID_AUTH_TYPES = ['none', 'apiKey', 'ntlm', 'certificate', 'oauth2', 'basic', 'cookie']

export interface BackupPayload {
  endpoints: any[]
  alerts?: any[]
  logs?: any[]
}

/**
 * Validates the shape of a parsed backup JSON payload: must have an
 * `endpoints` array where every entry has a string id/name/url, a
 * well-formed URL, and a recognized authType.
 */
export function validateBackupPayload(parsed: unknown): { valid: true; value: BackupPayload } | { valid: false; reason: string } {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, reason: 'Backup payload is not an object' }
  }

  const source = parsed as Record<string, unknown>
  if (!Array.isArray(source.endpoints)) {
    return { valid: false, reason: 'Backup payload is missing an "endpoints" array' }
  }

  for (const ep of source.endpoints) {
    if (!ep || typeof ep !== 'object') {
      return { valid: false, reason: 'Endpoint entry is not an object' }
    }
    const e = ep as Record<string, unknown>
    if (!e.id || typeof e.id !== 'string') {
      return { valid: false, reason: 'Endpoint entry is missing a string id' }
    }
    if (!e.name || typeof e.name !== 'string') {
      return { valid: false, reason: `Endpoint ${e.id} is missing a string name` }
    }
    if (!e.url || typeof e.url !== 'string') {
      return { valid: false, reason: `Endpoint ${e.id} is missing a string url` }
    }
    try {
      new URL(e.url)
    } catch {
      return { valid: false, reason: `Endpoint ${e.id} has a malformed url: ${e.url}` }
    }
    if (!VALID_AUTH_TYPES.includes(e.authType as string)) {
      return { valid: false, reason: `Endpoint ${e.id} has an unrecognized authType: ${e.authType}` }
    }
  }

  return {
    valid: true,
    value: {
      endpoints: source.endpoints,
      alerts: Array.isArray(source.alerts) ? source.alerts : undefined,
      logs: Array.isArray(source.logs) ? source.logs : undefined
    }
  }
}
