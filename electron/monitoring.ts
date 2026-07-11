import axios from 'axios'
import https from 'https'
import http from 'http'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { Notification, safeStorage } from 'electron'
import DatabaseService from './database'
import { Endpoint, Alert, Log } from '../src/types'
import { NtlmClient } from 'axios-ntlm'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import nodemailer from 'nodemailer' // P16-13: top-level import — module is cached once, not re-required on every alert flush
import { validateWebhookUrl } from './lib/webhookGuard'
import Store from 'electron-store'

// Map of active timers per endpoint id
const activeTimers = new Map<string, NodeJS.Timeout>()

// Cache for deduplicating identical overlapping HTTP requests
const activeRequests = new Map<string, Promise<any>>()

// Caches for OAuth2 tokens and Cookie Jars
const oauth2Cache = new Map<string, { token: string; expiresAt: number }>()
const cookieJars = new Map<string, CookieJar>()

// Cookie session validity tracking — only re-login when session has expired
const cookieSessionExpiry = new Map<string, number>()
const COOKIE_SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

// Persistent keep-alive agents per endpoint, reused across every recurring check.
// NTLM in particular authenticates the connection, not the request — without a
// shared keep-alive agent, every poll re-runs the full handshake. Evicted in
// unschedule() (called on every edit/resave via schedule(), and on delete).
const agentCache = new Map<string, { http: http.Agent; https: https.Agent }>()

// Shared by getAgentsForEndpoint() and testConnection() — reject unauthorised by
// default (secure); only disabled via the endpoint's allowSelfSigned flag, or a
// certificate's own rejectUnauthorized setting for mTLS endpoints.
function buildAgentOptions(endpoint: Partial<Endpoint>): any {
  const defaultRejectUnauthorized = !(endpoint.allowSelfSigned === true)
  const agentOptions: any = { rejectUnauthorized: defaultRejectUnauthorized }

  if (endpoint.authType === 'certificate') {
    const auth = endpoint.authConfig
    if (auth && 'certPath' in auth && auth.certPath && fs.existsSync(auth.certPath)) {
      const cert = fs.readFileSync(auth.certPath)
      agentOptions.pfx = cert
      agentOptions.passphrase = auth.passphrase || ''
      agentOptions.rejectUnauthorized = auth.rejectUnauthorized ?? defaultRejectUnauthorized
    }
  }

  return agentOptions
}

function getAgentsForEndpoint(endpoint: Endpoint): { http: http.Agent; https: https.Agent } {
  const cached = agentCache.get(endpoint.id)
  if (cached) return cached

  const agentOptions = { ...buildAgentOptions(endpoint), keepAlive: true, maxSockets: 10 }
  const agents = {
    http: new http.Agent({ keepAlive: true, maxSockets: 10 }),
    https: new https.Agent(agentOptions)
  }
  agentCache.set(endpoint.id, agents)
  return agents
}

// --- Alert burst protection (P16-4) ---
// Outage events that arrive within ALERT_DEBOUNCE_MS of the first call are
// batched together and dispatched as a single notification.
const ALERT_DEBOUNCE_MS = 60 * 1000 // 60-second accumulation window
let webhookOutageBuffer: string[] = []
let webhookFlushTimer: NodeJS.Timeout | null = null
let emailOutageBuffer: string[] = []
let emailFlushTimer: NodeJS.Timeout | null = null

// Module-level electron-store singleton (avoids repeated construction per loop)
// See main.ts's mainStore for why Record<string, any> instead of a stricter shape.
const monitorStore = new Store<Record<string, any>>()

const RESPONSE_BODY_CAP = 20 * 1024 // 20 KB — enough for a response inspector, not enough to bloat the UI

function formatResponseBody(data: unknown): string {
  let text: string
  try {
    text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  } catch {
    text = String(data)
  }
  return text.length > RESPONSE_BODY_CAP ? `${text.slice(0, RESPONSE_BODY_CAP)}\n… (truncated)` : text
}

async function getOAuth2Token(endpointId: string, authConfig: any): Promise<string> {
  const cached = oauth2Cache.get(endpointId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  if (!authConfig.tokenUrl || !authConfig.clientId) {
    throw new Error('OAuth2 configuration is missing tokenUrl or clientId')
  }

  const response = await axios.post(authConfig.tokenUrl, new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: authConfig.clientId,
    client_secret: authConfig.clientSecret,
    ...(authConfig.scope ? { scope: authConfig.scope } : {})
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 10000
  })

  const token = response.data.access_token
  const expiresIn = response.data.expires_in || 3600
  oauth2Cache.set(endpointId, {
    token,
    expiresAt: Date.now() + (expiresIn - 30) * 1000
  })
  return token
}

function getCookieJarClient(endpointId: string) {
  let jar = cookieJars.get(endpointId)
  if (!jar) {
    jar = new CookieJar()
    cookieJars.set(endpointId, jar)
  }
  return wrapper(axios.create({ jar, withCredentials: true }))
}

async function performCookieLogin(endpointId: string, authConfig: any) {
  const client = getCookieJarClient(endpointId)
  await client.post(authConfig.loginUrl, authConfig.credentials || {}, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  })
}

// Only re-runs the login flow when the cached session has expired or was invalidated
async function performCookieLoginIfNeeded(endpointId: string, authConfig: any) {
  const now = Date.now()
  const expiry = cookieSessionExpiry.get(endpointId) ?? 0
  if (expiry < now) {
    await performCookieLogin(endpointId, authConfig)
    cookieSessionExpiry.set(endpointId, now + COOKIE_SESSION_TTL_MS)
  }
}

// --- Heartbeat (P4, July 17 sprint) ---
// One aggregate log entry per sweep — not per-endpoint — so overnight/weekend
// coverage can be proven without multiplying log volume by endpoint count.
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000 // hourly
let heartbeatTimer: NodeJS.Timeout | null = null

function emitHeartbeat() {
  const endpoints = DatabaseService.getEndpoints().filter((ep) => !ep.id.startsWith('seed-'))
  const healthy = endpoints.filter((ep) => ep.status === 'success').length
  const down = endpoints.filter((ep) => ep.status === 'error').length
  const paused = endpoints.filter((ep) => ep.monitoringPaused).length
  DatabaseService.saveLog({
    id: randomUUID(),
    message: `Heartbeat: ${endpoints.length} endpoint(s) monitored — ${healthy} healthy, ${down} down, ${paused} paused.`,
    timestamp: new Date().toISOString(),
    type: 'info'
  })
}

export const MonitoringService = {
  onStateChange: null as (() => void) | null,

  start() {
    console.log('Background Monitoring Engine started...')
    this.scheduleAll()
    if (!heartbeatTimer) {
      emitHeartbeat() // immediate proof-of-life entry on launch, not just on the hour
      heartbeatTimer = setInterval(emitHeartbeat, HEARTBEAT_INTERVAL_MS)
    }
  },

  scheduleAll() {
    const endpoints = DatabaseService.getEndpoints()
    endpoints.forEach((ep, index) => {
      // Reset stale last-known status at launch so the dashboard never shows a
      // prior-run outage/success as if it were current while the first post-launch
      // check is still pending. Seed/demo endpoints are excluded — they're a static
      // snapshot, and resetting their status would defeat the demo they're seeded for.
      if (!ep.id.startsWith('seed-') && ep.status !== 'idle') {
        DatabaseService.saveEndpoint({ ...ep, status: 'idle' })
      }
      this.schedule(ep, index)
    })
  },

  // staggerIndex is only passed by scheduleAll() at startup — it spreads the
  // initial sweep out instead of every endpoint firing in the same instant,
  // avoiding a thundering-herd of concurrent outbound requests on every launch.
  // Ad-hoc callers (add/edit/refresh) omit it and get the original 1s delay.
  schedule(endpoint: Endpoint, staggerIndex?: number) {
    // Clear existing timer if any
    this.unschedule(endpoint.id)

    // Demo/seed endpoints are a static snapshot for exploring the UI, not real
    // monitors — putting them on the live recurring loop meant their mocked check
    // silently overwrote the very state (e.g. Paused — Auth Lockout) they were
    // seeded to demonstrate, on a resource-consuming schedule, forever.
    if (endpoint.id.startsWith('seed-')) {
      return
    }

    // Schedule immediate/initial run loop
    const initialDelayMs = staggerIndex !== undefined ? 1000 + staggerIndex * 250 : 1000
    const timer = setTimeout(() => this.runCheckLoop(endpoint.id), initialDelayMs)
    activeTimers.set(endpoint.id, timer)
  },

  unschedule(id: string) {
    if (activeTimers.has(id)) {
      clearTimeout(activeTimers.get(id)!)
      activeTimers.delete(id)
    }
    // Evict cached auth sessions to prevent memory leaks when endpoints are deleted or unscheduled
    oauth2Cache.delete(id)
    cookieJars.delete(id)
    cookieSessionExpiry.delete(id)
    // schedule() always calls unschedule() first, so this also invalidates the
    // cached agent on every edit/resave (auth or cert changes take effect immediately)
    const agents = agentCache.get(id)
    if (agents) {
      agents.http.destroy()
      agents.https.destroy()
      agentCache.delete(id)
    }
  },

  // True while an endpoint's recurring check loop is armed — false after AD Lockout
  // Protection has halted it, until it's rescheduled (edit/save, or a manual recheck).
  isScheduled(id: string): boolean {
    return activeTimers.has(id)
  },

  async runCheckLoop(id: string) {
    let halted = false
    try {
      if (!monitorStore.get('maintenanceMode', false)) {
        halted = !!(await this.checkEndpoint(id))
      }
    } catch (err: any) {
      console.error(`Error in check loop for endpoint ${id}:`, err)
    }

    if (halted) {
      // AD Lockout Protection engaged — checkEndpoint already recorded the failure
      // and fired an alert; don't reschedule until a manual recheck or edit/save
      // resumes the loop (see isScheduled / refresh-endpoint).
      return
    }

    const endpoints = DatabaseService.getEndpoints()
    const endpoint = endpoints.find((e) => e.id === id)
    if (endpoint) {
      const intervalMs = endpoint.interval * 60 * 1000
      const timer = setTimeout(() => this.runCheckLoop(id), intervalMs)
      activeTimers.set(id, timer)
    }
  },

  async checkEndpoint(id: string) {
    const endpoints = DatabaseService.getEndpoints()
    const endpoint = endpoints.find((e) => e.id === id)
    if (!endpoint) return

    const startTime = Date.now()
    let status: 'success' | 'error' = 'success'
    let latency = 0
    let errorMessage = ''
    // Set when AD Lockout Protection engages — signals runCheckLoop to stop
    // rescheduling this endpoint, *after* the normal status/alert code below runs.
    let adLockoutHalt = false

    try {
      if (id.startsWith('seed-')) {
        if (id.startsWith('seed-error-')) {
          // Mock a failing endpoint to trigger alerts and test SMTP
          latency = 5000
          status = 'error'
          await new Promise((resolve) => setTimeout(resolve, 500))
          throw new Error('Simulated 503 Service Unavailable')
        } else {
          // Mock successful checks for healthy seed endpoints
          latency = Math.floor(Math.random() * 80) + 70 // 70ms - 150ms
          status = 'success'
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } else {
        const requestTimeout = endpoint.timeout ? (endpoint.timeout * 1000) : 15000
        const config: any = {
          method: 'GET',
          url: endpoint.url,
          timeout: requestTimeout,
          headers: {}
        }

        // Shared, persistent keep-alive agents (per endpoint) — never rebuilt per
        // check. Reject unauthorised by default (secure); only disabled when the
        // user has explicitly enabled "Allow Self-Signed Certificates", or via a
        // certificate's own rejectUnauthorized setting for mTLS endpoints.
        const agents = getAgentsForEndpoint(endpoint)
        config.httpsAgent = agents.https
        config.httpAgent = agents.http

        let response: any

        const cacheKey = `${endpoint.url}|${endpoint.authType}|${JSON.stringify(endpoint.authConfig || {})}`
        if (activeRequests.has(cacheKey)) {
          response = await activeRequests.get(cacheKey)
        } else {
          let reqPromise: Promise<any>
          
          if (endpoint.authType === 'ntlm') {
            // NtlmClient(credentials, axiosConfig) returns a configured axios instance —
            // it is not itself a request dispatcher, so requests go through .get() on it.
            const auth = endpoint.authConfig as any
            const ntlmClient = NtlmClient(
              {
                username: auth.username,
                password: auth.password,
                domain: auth.domain,
                workstation: auth.workstation || ''
              },
              { httpsAgent: config.httpsAgent, httpAgent: config.httpAgent, timeout: requestTimeout }
            )
            reqPromise = ntlmClient.get(endpoint.url)
          } else {
            // Standard Axios config setup
            if (endpoint.authType === 'apiKey') {
              const auth = endpoint.authConfig as any
              if (auth.location === 'header') {
                config.headers[auth.key] = auth.value
              } else if (auth.location === 'query') {
                const urlObj = new URL(endpoint.url)
                urlObj.searchParams.append(auth.key, auth.value)
                config.url = urlObj.toString()
              }
            } else if (endpoint.authType === 'basic') {
              const auth = endpoint.authConfig as any
              const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
              config.headers.Authorization = `Basic ${token}`
            } else if (endpoint.authType === 'oauth2') {
              const auth = endpoint.authConfig
              const token = await getOAuth2Token(id, auth)
              config.headers.Authorization = `Bearer ${token}`
            }

            if (endpoint.authType === 'cookie') {
              const auth = endpoint.authConfig
              const client = getCookieJarClient(id)
              // Only re-login when the cached session has expired
              await performCookieLoginIfNeeded(id, auth)
              reqPromise = client.request(config)
            } else {
              reqPromise = axios(config)
            }
          }

          activeRequests.set(cacheKey, reqPromise)
          try {
            response = await reqPromise
          } finally {
            activeRequests.delete(cacheKey)
          }
        }

        latency = Date.now() - startTime
        status = response.status >= 200 && response.status < 400 ? 'success' : 'error'
        
        // Invalidate cookie session cache on auth failures so the next check re-logs in
        if (endpoint.authType === 'cookie' && (response.status === 401 || response.status === 403)) {
          cookieSessionExpiry.delete(id)
        }
        
        // AD Lockout Protection for NTLM and Basic — record the failure through the
        // normal status/alert path below (so it's visible), and signal a halt instead
        // of throwing, since throwing here would skip that path entirely.
        if ((endpoint.authType === 'ntlm' || endpoint.authType === 'basic') && (response.status === 401 || response.status === 403)) {
           errorMessage = 'Authentication rejected (401/403) — AD Lockout Protection engaged, automatic checks paused for this endpoint until it is rechecked or re-saved.'
           adLockoutHalt = true
        }
      }
    } catch (err: any) {
      status = 'error'
      latency = Date.now() - startTime
      errorMessage = err.message || 'Network connection refused'

      // Invalidate cookie session on any network error so the next cycle attempts a fresh login
      if (endpoint.authType === 'cookie') {
        cookieSessionExpiry.delete(id)
      }
    }

    // Process and Update Endpoint State
    const currentList = DatabaseService.getEndpoints()
    const currentEp = currentList.find((e) => e.id === id)
    if (!currentEp) return

    const updatedLatencyHistory = [...(currentEp.responseTimeHistory || []), latency].slice(-10)
    
    let consecutiveErrors = currentEp.consecutiveErrors
    let errorCount = currentEp.errorCount

    if (status === 'error') {
      consecutiveErrors += 1
      errorCount += 1
      
      // Read the configured threshold from settings (P16-5); default to 2 if not set.
      // AD Lockout Protection always alerts immediately — the loop halts after this
      // single check, so waiting for the normal consecutive-failure threshold would
      // mean it never fires and the endpoint goes silently dark.
      const threshold = parseInt(String(monitorStore.get('alertThreshold', 2)), 10) || 2
      if (adLockoutHalt || consecutiveErrors === threshold || (consecutiveErrors > threshold && consecutiveErrors % 5 === 0)) {
        const alert: Alert = {
          id: randomUUID(),
          endpointId: currentEp.id,
          endpointName: currentEp.name,
          message: errorMessage || `Failed checks consecutive threshold hit (${consecutiveErrors} failures).`,
          timestamp: new Date().toISOString(),
          read: false
        }
        DatabaseService.saveAlert(alert)
        this.dispatchNotification(currentEp.name, alert.message)
        this.triggerWebhook(currentEp.name, alert.message)
        this.triggerEmail(currentEp.name, alert.message)
      }
    } else {
      consecutiveErrors = 0
    }

    const updatedEndpoint: Endpoint = {
      ...currentEp,
      status,
      lastCheck: new Date().toISOString(),
      consecutiveErrors,
      errorCount,
      responseTimeHistory: updatedLatencyHistory,
      // True only while actively halted by AD Lockout Protection; a subsequent
      // check (manual recheck or resumed schedule) clears it back to false.
      monitoringPaused: adLockoutHalt
    }

    DatabaseService.saveEndpoint(updatedEndpoint)

    // Save check audit log
    const checkLog: Log = {
      id: randomUUID(),
      endpointId: currentEp.id,
      endpointName: currentEp.name,
      message: status === 'success' ? `Reachable. Latency: ${latency}ms.` : `Failure check: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      type: status === 'success' ? 'info' : 'error'
    }
    DatabaseService.saveLog(checkLog)

    if (this.onStateChange) {
      this.onStateChange()
    }

    return adLockoutHalt
  },

  dispatchNotification(title: string, message: string) {
    if (Notification.isSupported()) {
      new Notification({
        title: `API Monitor: ${title}`,
        body: message
      }).show()
    }
  },

  triggerWebhook(endpointName: string, _message: string) {
    // P16-4: Accumulate into buffer; arm a single flush timer for the whole batch window
    if (!webhookOutageBuffer.includes(endpointName)) {
      webhookOutageBuffer.push(endpointName)
    }
    if (webhookFlushTimer !== null) return // flush already scheduled — buffer will drain then

    webhookFlushTimer = setTimeout(async () => {
      const batch = [...webhookOutageBuffer]
      webhookOutageBuffer = []
      webhookFlushTimer = null
      if (batch.length === 0) return

      const webhookUrl = monitorStore.get('globalWebhook')
      const channelType = monitorStore.get('globalWebhookChannel') || 'msteams'
      if (!webhookUrl || typeof webhookUrl !== 'string') return

      const urlCheck = validateWebhookUrl(webhookUrl)
      if (!urlCheck.valid) {
        console.error(`[security] Webhook URL rejected during dispatch: ${urlCheck.reason}`)
        return
      }

      try {
        const count = batch.length
        const nameList = batch.map(n => `\`${n}\``).join(', ')
        const alertText = count === 1
          ? `🚨 **[API Monitor Alert]** \`${batch[0]}\` is offline!`
          : `🚨 **[API Monitor Alert]** ${count} endpoints are offline: ${nameList}`

        const payload: any = channelType === 'discord'
          ? { content: alertText }
          : { text: alertText }

        await axios.post(webhookUrl as string, payload)
        console.log(`Webhook alert dispatched (${count} endpoint(s)).`)
      } catch (err: any) {
        console.error('Failed dispatching webhook alert', err.message)
      }
    }, ALERT_DEBOUNCE_MS)
  },

  triggerEmail(endpointName: string, _message: string) {
    // P16-4: Accumulate into buffer; arm a single flush timer for the whole batch window
    if (!emailOutageBuffer.includes(endpointName)) {
      emailOutageBuffer.push(endpointName)
    }
    if (emailFlushTimer !== null) return // flush already scheduled — buffer will drain then

    emailFlushTimer = setTimeout(async () => {
      const batch = [...emailOutageBuffer]
      emailOutageBuffer = []
      emailFlushTimer = null
      if (batch.length === 0) return

      const smtpServer = monitorStore.get('smtpServer', '')
      const smtpPort = monitorStore.get('smtpPort', '587')
      const smtpUser = monitorStore.get('smtpUser', '')
      const smtpPassEncryptedB64 = monitorStore.get('smtpPassEncrypted', '') as string
      let smtpPass = ''
      if (smtpPassEncryptedB64) {
        try {
          smtpPass = safeStorage.decryptString(Buffer.from(smtpPassEncryptedB64, 'base64'))
        } catch {
          smtpPass = ''
        }
      }
      const notifyEmail = monitorStore.get('notifyEmail', '')
      if (!smtpServer || !notifyEmail) return

      try {
        const smtpAllowSelfSigned = monitorStore.get('smtpAllowSelfSigned', false) === true
        const transporter = nodemailer.createTransport({
          host: smtpServer,
          port: parseInt(smtpPort, 10),
          secure: parseInt(smtpPort, 10) === 465,
          auth: (smtpUser && smtpPass) ? { user: smtpUser, pass: smtpPass } : undefined,
          tls: { rejectUnauthorized: !smtpAllowSelfSigned }
        })

        const emails = notifyEmail.split(',').map((e: string) => e.trim()).filter(Boolean)
        const count = batch.length
        const isSingle = count === 1

        const subject = isSingle
          ? `🚨 Alert: ${batch[0]} is offline!`
          : `🚨 Alert: ${count} endpoints are offline`

        const textBody = isSingle
          ? `The endpoint "${batch[0]}" is currently offline. Please investigate immediately.`
          : `${count} endpoints are currently offline:\n${batch.map(n => `  • ${n}`).join('\n')}\n\nPlease investigate immediately.`

        const htmlEndpoints = isSingle
          ? `<p style="font-size:16px;margin-top:0;"><strong>${batch[0]}</strong> is offline!</p>`
          : `<p style="font-size:16px;margin-top:0;"><strong>${count} endpoints</strong> are currently offline:</p>
             <ul style="padding-left:20px;">${batch.map(n => `<li><strong>${n}</strong></li>`).join('')}</ul>`

        await transporter.sendMail({
          from: `"Xerox API Monitor" <${smtpUser || 'noreply@xerox-monitor.local'}>`,
          to: emails.join(', '),
          subject,
          text: textBody,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <div style="background-color:#ef4444;padding:16px;color:white;">
                <h2 style="margin:0;font-size:18px;">🚨 API Monitor Alert</h2>
              </div>
              <div style="padding:24px;background-color:#f8fafc;color:#334155;">
                ${htmlEndpoints}
                <p>Please check the affected endpoint(s) and server connections immediately.</p>
                <hr style="border:none;border-top:1px solid #cbd5e1;margin:24px 0;" />
                <p style="font-size:12px;color:#64748b;margin-bottom:0;">Sent automatically by your local Xerox API Monitor background service.</p>
              </div>
            </div>
          `
        })
        console.log(`SMTP alert dispatched (${count} endpoint(s)).`)
      } catch (err: any) {
        console.error('Failed dispatching SMTP alert', err.message)
      }
    }, ALERT_DEBOUNCE_MS)
  },

  async testConnection(endpoint: Partial<Endpoint>): Promise<{ success: boolean; status?: number; message?: string; body?: string; timeMs?: number }> {
    if (!endpoint.url) {
      return { success: false, message: 'URL is required' }
    }
    const startTime = Date.now()
    try {
      const requestTimeout = endpoint.timeout ? (endpoint.timeout * 1000) : 10000
      const config: any = {
        method: 'GET',
        url: endpoint.url,
        timeout: requestTimeout,
        headers: {}
      }

      // Intentionally uncached (unlike getAgentsForEndpoint) — this may be testing
      // draft config that's never saved, so there's nothing to key a cache on yet.
      config.httpsAgent = new https.Agent(buildAgentOptions(endpoint))

      let response: any

      if (endpoint.authType === 'ntlm') {
        const auth = endpoint.authConfig as any
        const ntlmClient = NtlmClient(
          {
            username: auth.username,
            password: auth.password,
            domain: auth.domain,
            workstation: auth.workstation || ''
          },
          { httpsAgent: config.httpsAgent, timeout: requestTimeout }
        )
        response = await ntlmClient.get(endpoint.url)
      } else {
        if (endpoint.authType === 'apiKey') {
          const auth = endpoint.authConfig as any
          if (auth.location === 'header') {
            config.headers[auth.key] = auth.value
          } else if (auth.location === 'query') {
            const urlObj = new URL(endpoint.url!)
            urlObj.searchParams.append(auth.key, auth.value)
            config.url = urlObj.toString()
          }
        } else if (endpoint.authType === 'basic') {
          const auth = endpoint.authConfig as any
          const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
          config.headers.Authorization = `Basic ${token}`
        } else if (endpoint.authType === 'oauth2') {
          const auth = endpoint.authConfig
          const token = await getOAuth2Token('test-temp', auth)
          config.headers.Authorization = `Bearer ${token}`
        }

        if (endpoint.authType === 'cookie') {
          const auth = endpoint.authConfig
          const client = getCookieJarClient('test-temp')
          await performCookieLogin('test-temp', auth)
          response = await client.request(config)
        } else {
          response = await axios(config)
        }
      }

      const timeMs = Date.now() - startTime
      const body = formatResponseBody(response.data)

      if (response.status >= 200 && response.status < 400) {
        return { success: true, status: response.status, body, timeMs }
      } else {
        return { success: false, status: response.status, message: `Returned status code ${response.status}`, body, timeMs }
      }
    } catch (err: any) {
      const timeMs = Date.now() - startTime
      const body = err.response ? formatResponseBody(err.response.data) : undefined
      return { success: false, status: err.response?.status, message: err.message || 'Connection failed', body, timeMs }
    } finally {
      // P16-3: Always remove test-temp entries — prevents indefinite Map growth on repeated test clicks
      oauth2Cache.delete('test-temp')
      cookieJars.delete('test-temp')
    }
  }
}
export default MonitoringService
