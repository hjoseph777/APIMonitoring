import { describe, it, expect } from 'vitest'
import { parseAndValidateSettings, DEFAULT_SETTINGS, asPortString, asThreshold, asWebhookChannel } from '../../electron/lib/settingsSchema'

describe('parseAndValidateSettings', () => {
  it('rejects a non-object payload', () => {
    const result = parseAndValidateSettings(null)
    expect(result.ok).toBe(false)
  })

  it('rejects an array payload', () => {
    const result = parseAndValidateSettings([1, 2, 3])
    expect(result.ok).toBe(false)
  })

  it('round-trips a fully valid payload unchanged', () => {
    const input = {
      ...DEFAULT_SETTINGS,
      smtpServer: 'smtp.internal.corp',
      smtpPort: '2525',
      notifyEmail: 'ops@corp.com, alerts@corp.com',
      alertThreshold: 5,
      globalWebhookChannel: 'discord'
    }
    const result = parseAndValidateSettings(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.smtpServer).toBe('smtp.internal.corp')
      expect(result.value.smtpPort).toBe('2525')
      expect(result.value.alertThreshold).toBe(5)
      expect(result.value.globalWebhookChannel).toBe('discord')
    }
  })

  it('falls back to defaults for missing fields instead of throwing', () => {
    const result = parseAndValidateSettings({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('coerces a non-boolean nativeNotify to the default rather than accepting it', () => {
    const result = parseAndValidateSettings({ nativeNotify: 'yes' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nativeNotify).toBe(DEFAULT_SETTINGS.nativeNotify)
    }
  })

  it('rejects a malformed recipient email', () => {
    const result = parseAndValidateSettings({ notifyEmail: 'not-an-email' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('not-an-email')
    }
  })

  it('rejects one bad address in a comma-separated list even if others are valid', () => {
    const result = parseAndValidateSettings({ notifyEmail: 'ops@corp.com, @bad.com' })
    expect(result.ok).toBe(false)
  })

  it('falls back to the default webhook channel for an unrecognized value', () => {
    const result = parseAndValidateSettings({ globalWebhookChannel: 'carrier-pigeon' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.globalWebhookChannel).toBe(DEFAULT_SETTINGS.globalWebhookChannel)
    }
  })
})

describe('asPortString', () => {
  it('accepts a valid port', () => {
    expect(asPortString('8080', '587')).toBe('8080')
  })
  it('rejects a port above 65535', () => {
    expect(asPortString('70000', '587')).toBe('587')
  })
  it('rejects a port below 1', () => {
    expect(asPortString('0', '587')).toBe('587')
  })
  it('rejects a non-numeric value', () => {
    expect(asPortString('not-a-port', '587')).toBe('587')
  })
})

describe('asThreshold', () => {
  it('clamps above the max to 20', () => {
    expect(asThreshold(999, 2)).toBe(20)
  })
  it('clamps below the min to 1', () => {
    expect(asThreshold(0, 2)).toBe(1)
  })
  it('passes through an in-range value', () => {
    expect(asThreshold(5, 2)).toBe(5)
  })
})

describe('asWebhookChannel', () => {
  it('accepts each valid enum value', () => {
    expect(asWebhookChannel('msteams', 'discord')).toBe('msteams')
    expect(asWebhookChannel('discord', 'msteams')).toBe('discord')
    expect(asWebhookChannel('slack', 'msteams')).toBe('slack')
  })
  it('falls back for an invalid value', () => {
    expect(asWebhookChannel('teams-classic', 'msteams')).toBe('msteams')
  })
})
