import axios from 'axios'
import https from 'https'
import fs from 'fs'
import { Notification } from 'electron'
import DatabaseService from './database'
import { Endpoint, Alert, Log } from '../src/types'

// Map of active intervals per endpoint id
const activeTimers = new Map<string, NodeJS.Timeout>()

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

    // Run first check asynchronously immediately
    setTimeout(() => this.checkEndpoint(endpoint.id), 1000)

    // Schedule intervals (interval is in minutes, convert to ms)
    const intervalMs = endpoint.interval * 60 * 1000
    const timer = setInterval(() => {
      this.checkEndpoint(endpoint.id)
    }, intervalMs)

    activeTimers.set(endpoint.id, timer)
  },

  unschedule(id: string) {
    if (activeTimers.has(id)) {
      clearInterval(activeTimers.get(id)!)
      activeTimers.delete(id)
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
        timeout: 15000
      }

      // Configure HTTPS Agent for SSL / self-signed certs
      const agentOptions: any = { rejectUnauthorized: false }
      
      // Apply authentication based on authType
      if (endpoint.authType === 'apiKey' && endpoint.authConfig.type === 'apiKey') {
        const auth = endpoint.authConfig
        if (auth.location === 'header') {
          config.headers = { ...config.headers, [auth.key]: auth.value }
        } else if (auth.location === 'query') {
          const urlObj = new URL(endpoint.url)
          urlObj.searchParams.append(auth.key, auth.value)
          config.url = urlObj.toString()
        }
      } else if (endpoint.authType === 'basic' && endpoint.authConfig.type === 'basic') {
        const auth = endpoint.authConfig
        const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
        config.headers = { ...config.headers, Authorization: `Basic ${token}` }
      } else if (endpoint.authType === 'certificate' && endpoint.authConfig.type === 'certificate') {
        const auth = endpoint.authConfig
        if (auth.certPath && fs.existsSync(auth.certPath)) {
          const cert = fs.readFileSync(auth.certPath)
          agentOptions.pfx = cert
          agentOptions.passphrase = auth.passphrase || ''
          agentOptions.rejectUnauthorized = auth.rejectUnauthorized ?? false
        }
      } else if (endpoint.authType === 'ntlm' && endpoint.authConfig.type === 'ntlm') {
        // NTLM fallback simulation / direct headers
        const auth = endpoint.authConfig
        config.headers = { ...config.headers, 'X-NTLM-Domain': auth.domain, 'X-NTLM-User': auth.username }
      }

      config.httpsAgent = new https.Agent(agentOptions)

      const response = await axios(config)
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
  }
}
export default MonitoringService
