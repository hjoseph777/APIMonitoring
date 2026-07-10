import { describe, it, expect } from 'vitest'
import { validateBackupPayload } from '../../electron/lib/backupValidation'

const validEndpoint = {
  id: 'ep-1',
  name: 'SAP ERP Gateway',
  url: 'https://sap-erp.internal.xerox.com/health',
  authType: 'ntlm'
}

describe('validateBackupPayload', () => {
  it('accepts a minimal valid payload', () => {
    const result = validateBackupPayload({ endpoints: [validEndpoint] })
    expect(result.valid).toBe(true)
  })

  it('accepts an empty endpoints array', () => {
    const result = validateBackupPayload({ endpoints: [] })
    expect(result.valid).toBe(true)
  })

  it('rejects a non-object payload', () => {
    expect(validateBackupPayload(null).valid).toBe(false)
    expect(validateBackupPayload('a string').valid).toBe(false)
    expect(validateBackupPayload(42).valid).toBe(false)
  })

  it('rejects a payload with no endpoints array', () => {
    const result = validateBackupPayload({ foo: 'bar' })
    expect(result.valid).toBe(false)
  })

  it('rejects an endpoint missing an id', () => {
    const result = validateBackupPayload({ endpoints: [{ ...validEndpoint, id: undefined }] })
    expect(result.valid).toBe(false)
  })

  it('rejects an endpoint missing a name', () => {
    const result = validateBackupPayload({ endpoints: [{ ...validEndpoint, name: '' }] })
    expect(result.valid).toBe(false)
  })

  it('rejects an endpoint with a malformed URL', () => {
    const result = validateBackupPayload({ endpoints: [{ ...validEndpoint, url: 'not a url' }] })
    expect(result.valid).toBe(false)
  })

  it('rejects an endpoint with an unrecognized authType', () => {
    const result = validateBackupPayload({ endpoints: [{ ...validEndpoint, authType: 'kerberos-v7' }] })
    expect(result.valid).toBe(false)
  })

  it('accepts every real supported authType', () => {
    const types = ['none', 'apiKey', 'ntlm', 'certificate', 'oauth2', 'basic', 'cookie']
    for (const authType of types) {
      const result = validateBackupPayload({ endpoints: [{ ...validEndpoint, authType }] })
      expect(result.valid, `authType ${authType} should be valid`).toBe(true)
    }
  })

  it('carries alerts and logs through when present and valid arrays', () => {
    const result = validateBackupPayload({
      endpoints: [validEndpoint],
      alerts: [{ id: 'a1' }],
      logs: [{ id: 'l1' }]
    })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.value.alerts).toHaveLength(1)
      expect(result.value.logs).toHaveLength(1)
    }
  })

  it('drops alerts/logs when present but not arrays, without rejecting the whole payload', () => {
    const result = validateBackupPayload({ endpoints: [validEndpoint], alerts: 'not-an-array' })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.value.alerts).toBeUndefined()
    }
  })

  it('rejects if any one endpoint in a multi-endpoint list is invalid', () => {
    const result = validateBackupPayload({
      endpoints: [validEndpoint, { ...validEndpoint, id: 'ep-2', url: 'garbage' }]
    })
    expect(result.valid).toBe(false)
  })
})
