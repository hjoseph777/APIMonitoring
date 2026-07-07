import axios from 'axios'
import https from 'https'
import fs from 'fs'
import { Notification } from 'electron'
import DatabaseService from './database'
import { Endpoint, Alert, Log } from '../src/types'
import axiosNtlm from 'axios-ntlm'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'

// Map of active timers per endpoint id
const activeTimers = new Map<string, NodeJS.Timeout>()

// Caches for OAuth2 tokens and Cookie Jars
const oauth2Cache = new Map<string, { token: string; expiresAt: number }>()
const cookieJars = new Map<string, CookieJar>()

async function getOAuth2Token(endpointId: string, authConfig: any): Promise<string> {
  const cached = oauth2Cache.get(endpointId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
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

export const MonitoringService = {
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
  },

  async runCheckLoop(id: string) {
    try {
      await this.checkEndpoint(id)
    } catch (err) {
      console.error(`Error in check loop for endpoint ${id}:`, err)
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

    try {
      const config: any = {
        method: 'GET',
        url: endpoint.url,
        timeout: 15000,
        headers: {}
      }

      // Configure HTTPS Agent for SSL / self-signed certs
      const agentOptions: any = { rejectUnauthorized: false }
      
      // Apply certificate config first if certificate auth
      if (endpoint.authType === 'certificate') {
        const auth = endpoint.authConfig
        if (auth && 'certPath' in auth && auth.certPath && fs.existsSync(auth.certPath)) {
          const cert = fs.readFileSync(auth.certPath)
          agentOptions.pfx = cert
          agentOptions.passphrase = auth.passphrase || ''
          agentOptions.rejectUnauthorized = auth.rejectUnauthorized ?? false
        }
      }

      config.httpsAgent = new https.Agent(agentOptions)

      let response: any

      if (endpoint.authType === 'ntlm') {
        const auth = endpoint.authConfig
        response = await axiosNtlm({
          method: 'GET',
          url: endpoint.url,
          timeout: 15000,
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
          // Run login first to seed cookies
          await performCookieLogin(id, auth)
          response = await client.request(config)
        } else {
          response = await axios(config)
        }
      }

      latency = Date.now() - startTime
      status = response.status >= 200 && response.status < 400 ? 'success' : 'error'
    } catch (err: any) {
      status = 'error'
      latency = Date.now() - startTime
      errorMessage = err.message || 'Network connection refused'
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
      
      // Save Alert log when threshold is reached (e.g. 2 consecutive errors)
      if (consecutiveErrors === 2 || consecutiveErrors % 5 === 0) {
        const alert: Alert = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
          endpointId: currentEp.id,
          endpointName: currentEp.name,
          message: errorMessage || `Failed checks consecutive threshold hit (${consecutiveErrors} failures).`,
          timestamp: new Date().toISOString(),
          read: false
        }
        DatabaseService.saveAlert(alert)
        this.dispatchNotification(currentEp.name, alert.message)
        this.triggerWebhook(currentEp.name, alert.message)
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
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      endpointId: currentEp.id,
      endpointName: currentEp.name,
      message: status === 'success' ? `Reachable. Latency: ${latency}ms.` : `Failure check: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      type: status === 'success' ? 'info' : 'error'
    }
    DatabaseService.saveLog(checkLog)
  },

  dispatchNotification(title: string, message: string) {
    if (Notification.isSupported()) {
      new Notification({
        title: `API Monitor: ${title}`,
        body: message
      }).show()
    }
  },

  async triggerWebhook(endpointName: string, message: string) {
    const Store = require('electron-store')
    const store = new Store()
    const webhookUrl = store.get('globalWebhook')
    if (!webhookUrl || typeof webhookUrl !== 'string') return

    try {
      await axios.post(webhookUrl, {
        content: `🚨 **[API Monitor Alert]** \`${endpointName}\` is offline!\nMessage: ${message}`
      })
      console.log('Webhook alert notification dispatched.')
    } catch (err: any) {
      console.error('Failed dispatching webhook alert', err.message)
    }
  },

  async testConnection(endpoint: Partial<Endpoint>): Promise<{ success: boolean; status?: number; message?: string }> {
    try {
      const config: any = {
        method: 'GET',
        url: endpoint.url,
        timeout: 10000,
        headers: {}
      }

      const agentOptions: any = { rejectUnauthorized: false }
      if (endpoint.authType === 'certificate') {
        const auth = endpoint.authConfig
        if (auth && 'certPath' in auth && auth.certPath && fs.existsSync(auth.certPath)) {
          const cert = fs.readFileSync(auth.certPath)
          agentOptions.pfx = cert
          agentOptions.passphrase = auth.passphrase || ''
          agentOptions.rejectUnauthorized = auth.rejectUnauthorized ?? false
        }
      }
      config.httpsAgent = new https.Agent(agentOptions)

      let response: any

      if (endpoint.authType === 'ntlm') {
        const auth = endpoint.authConfig
        response = await axiosNtlm({
          method: 'GET',
          url: endpoint.url,
          timeout: 10000,
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
    }
  }
}
export default MonitoringService
