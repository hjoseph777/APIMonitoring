import axios from 'axios'
import https from 'https'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { Notification, safeStorage } from 'electron'
import DatabaseService from './database'
import { Endpoint, Alert, Log } from '../src/types'
import axiosNtlm from 'axios-ntlm'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import nodemailer from 'nodemailer' // P16-13: top-level import — module is cached once, not re-required on every alert flush
import { validateWebhookUrl } from './main'

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

// --- Alert burst protection (P16-4) ---
// Outage events that arrive within ALERT_DEBOUNCE_MS of the first call are
// batched together and dispatched as a single notification.
const ALERT_DEBOUNCE_MS = 60 * 1000 // 60-second accumulation window
let webhookOutageBuffer: string[] = []
let webhookFlushTimer: NodeJS.Timeout | null = null
let emailOutageBuffer: string[] = []
let emailFlushTimer: NodeJS.Timeout | null = null

// Module-level electron-store singleton (avoids repeated construction per loop)
const Store = require('electron-store')
const monitorStore = new Store()

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

export const MonitoringService = {
  onStateChange: null as (() => void) | null,

  start() {
    console.log('Background Monitoring Engine started...')
    this.scheduleAll()
  },

  scheduleAll() {
    const endpoints = DatabaseService.getEndpoints()
    endpoints.forEach((ep) => this.schedule(ep))
  },

  schedule(endpoint: Endpoint) {
    // Clear existing timer if any
    this.unschedule(endpoint.id)

    // Schedule immediate/initial run loop
    const timer = setTimeout(() => this.runCheckLoop(endpoint.id), 1000)
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

        // Configure HTTPS Agent for SSL / self-signed certs.
        // Reject unauthorised by default (secure). Only disable when the user
        // has explicitly enabled "Allow Self-Signed Certificates" on this endpoint,
        // or when using certificate auth where the server cert may be self-signed.
        const defaultRejectUnauthorized = !(endpoint.allowSelfSigned === true)
        const agentOptions: any = { rejectUnauthorized: defaultRejectUnauthorized }
        
        // Apply certificate config first if certificate auth
        if (endpoint.authType === 'certificate') {
          const auth = endpoint.authConfig
          if (auth && 'certPath' in auth && auth.certPath && fs.existsSync(auth.certPath)) {
            const cert = fs.readFileSync(auth.certPath)
            agentOptions.pfx = cert
            agentOptions.passphrase = auth.passphrase || ''
            // For mTLS, respect the per-cert setting; fall back to the endpoint's allowSelfSigned flag
            agentOptions.rejectUnauthorized = auth.rejectUnauthorized ?? defaultRejectUnauthorized
          }
        }

        config.httpsAgent = new https.Agent(agentOptions)

        let response: any

        const cacheKey = `${endpoint.url}|${endpoint.authType}|${JSON.stringify(endpoint.authConfig || {})}`
        if (activeRequests.has(cacheKey)) {
          response = await activeRequests.get(cacheKey)
        } else {
          let reqPromise: Promise<any>
          
          if (endpoint.authType === 'ntlm') {
            const auth = endpoint.authConfig
            reqPromise = axiosNtlm({
              method: 'GET',
              url: endpoint.url,
              timeout: requestTimeout,
              httpsAgent: config.httpsAgent,
              ntlm: {
                username: (auth as any).username,
                password: (auth as any).password,
                domain: (auth as any).domain,
                workstation: (auth as any).workstation || ''
              },
              withCredentials: true
            })
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
      responseTimeHistory: updatedLatencyHistory
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

  async testConnection(endpoint: Partial<Endpoint>): Promise<{ success: boolean; status?: number; message?: string }> {
    try {
      const requestTimeout = endpoint.timeout ? (endpoint.timeout * 1000) : 10000
      const config: any = {
        method: 'GET',
        url: endpoint.url,
        timeout: requestTimeout,
        headers: {}
      }

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
      config.httpsAgent = new https.Agent(agentOptions)

      let response: any

      if (endpoint.authType === 'ntlm') {
        const auth = endpoint.authConfig
        response = await axiosNtlm({
          method: 'GET',
          url: endpoint.url,
          timeout: requestTimeout,
          httpsAgent: config.httpsAgent,
          ntlm: {
            username: (auth as any).username,
            password: (auth as any).password,
            domain: (auth as any).domain,
            workstation: (auth as any).workstation || ''
          },
          withCredentials: true
        })
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

      if (response.status >= 200 && response.status < 400) {
        return { success: true, status: response.status }
      } else {
        return { success: false, status: response.status, message: `Returned status code ${response.status}` }
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' }
    } finally {
      // P16-3: Always remove test-temp entries — prevents indefinite Map growth on repeated test clicks
      oauth2Cache.delete('test-temp')
      cookieJars.delete('test-temp')
    }
  }
}
export default MonitoringService
