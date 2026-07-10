// Pure SSRF guard logic — no Electron imports, so this can be unit tested
// directly without a running Electron process.

/**
 * Validates that a webhook URL is safe to POST to.
 * Blocks non-HTTPS protocols and loopback / RFC-1918 private addresses.
 */
export function validateWebhookUrl(url: string): { valid: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTPS webhook URLs are permitted' }
  }
  // URL.hostname keeps brackets around IPv6 literals (e.g. "[::1]"), which never
  // matched a bare '::1' comparison — this loopback check was silently inert.
  const h = parsed.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') {
    return { valid: false, reason: 'Loopback addresses are not permitted' }
  }
  const ipv4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4) {
    const [, a, b] = ipv4.map(Number)
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return { valid: false, reason: 'Private network addresses are not permitted' }
    }
  }
  return { valid: true }
}
