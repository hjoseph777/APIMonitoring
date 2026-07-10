import { describe, it, expect } from 'vitest'
import { validateWebhookUrl } from '../../electron/lib/webhookGuard'

describe('validateWebhookUrl', () => {
  it('accepts a normal public HTTPS webhook', () => {
    expect(validateWebhookUrl('https://outlook.office.com/webhook/abc123').valid).toBe(true)
  })

  it('rejects a malformed URL', () => {
    const result = validateWebhookUrl('not a url')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/invalid url/i)
  })

  it('rejects plain HTTP', () => {
    const result = validateWebhookUrl('http://outlook.office.com/webhook/abc123')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/https/i)
  })

  it('rejects localhost by name', () => {
    expect(validateWebhookUrl('https://localhost/hook').valid).toBe(false)
  })

  it('rejects 127.0.0.1', () => {
    expect(validateWebhookUrl('https://127.0.0.1/hook').valid).toBe(false)
  })

  it('rejects the IPv6 loopback address', () => {
    expect(validateWebhookUrl('https://[::1]/hook').valid).toBe(false)
  })

  it('rejects 10.x.x.x private range', () => {
    expect(validateWebhookUrl('https://10.0.0.5/hook').valid).toBe(false)
  })

  it('rejects 192.168.x.x private range', () => {
    expect(validateWebhookUrl('https://192.168.1.1/hook').valid).toBe(false)
  })

  it('rejects the 172.16.0.0/12 private range', () => {
    expect(validateWebhookUrl('https://172.16.0.1/hook').valid).toBe(false)
    expect(validateWebhookUrl('https://172.31.255.255/hook').valid).toBe(false)
  })

  it('does not reject 172.x outside the private range (172.32.x.x)', () => {
    expect(validateWebhookUrl('https://172.32.0.1/hook').valid).toBe(true)
  })

  it('does not false-positive on a public IP that merely starts with 192', () => {
    expect(validateWebhookUrl('https://192.169.1.1/hook').valid).toBe(true)
  })
})
