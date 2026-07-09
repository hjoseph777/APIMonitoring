import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import Store from 'electron-store'
import { Endpoint, Alert, Log } from '../src/types'

// We will attempt to use better-sqlite3, but fallback to electron-store if native compilation is missing or fails.
let dbInstance: any = null
let useSqlite = false
const store = new Store()

try {
  const Database = require('better-sqlite3')
  const dbPath = join(app.getPath('userData'), 'api_monitor.db')
  dbInstance = new Database(dbPath)
  useSqlite = true

  // Initialize SQLite tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      interval INTEGER NOT NULL,
      status TEXT NOT NULL,
      lastCheck TEXT,
      errorCount INTEGER DEFAULT 0,
      consecutiveErrors INTEGER DEFAULT 0,
      authType TEXT NOT NULL,
      authConfig TEXT NOT NULL,
      responseTimeHistory TEXT,
      timeout INTEGER
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      endpointId TEXT NOT NULL,
      endpointName TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      endpointId TEXT,
      endpointName TEXT,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      success INTEGER DEFAULT 1
    );
  `)

  // Run migration for existing databases
  try {
    dbInstance.exec('ALTER TABLE endpoints ADD COLUMN timeout INTEGER;')
  } catch (err) {
    // Column already exists, ignore
  }

  console.log('Database initialized successfully using better-sqlite3 at:', dbPath)
} catch (e: any) {
  console.warn('better-sqlite3 native compilation not available or failed to load. Falling back to electron-store file-based DB.', e.message)
  useSqlite = false

  // Seed initial store keys if empty
  if (!store.has('endpoints')) store.set('endpoints', [])
  if (!store.has('alerts')) store.set('alerts', [])
  if (!store.has('logs')) store.set('logs', [])
}

export const DatabaseService = {
  purgeOldLogs() {
    try {
      const cutOffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      if (useSqlite) {
        dbInstance.prepare('DELETE FROM logs WHERE timestamp < ?').run(cutOffDate)
        dbInstance.prepare('DELETE FROM alerts WHERE timestamp < ?').run(cutOffDate)
        console.log('Database logs and alerts older than 7 days purged.')
      } else {
        const logs = (store.get('logs') as Log[]) || []
        const filteredLogs = logs.filter((l: Log) => l.timestamp >= cutOffDate)
        store.set('logs', filteredLogs)

        const alerts = (store.get('alerts') as Alert[]) || []
        const filteredAlerts = alerts.filter((a: Alert) => a.timestamp >= cutOffDate)
        store.set('alerts', filteredAlerts)
        console.log('Electron store logs and alerts older than 7 days purged.')
      }
    } catch (e: any) {
      console.error('Failed to purge old logs:', e.message)
    }
  },

  // Endpoints CRUD
  getEndpoints(): Endpoint[] {
    if (useSqlite) {
      const rows = dbInstance.prepare('SELECT * FROM endpoints').all()
      return rows.map((row: any) => ({
        ...row,
        responseTimeHistory: row.responseTimeHistory ? JSON.parse(row.responseTimeHistory) : [],
        authConfig: JSON.parse(row.authConfig)
      }))
    } else {
      return (store.get('endpoints') as Endpoint[]) || []
    }
  },

  saveEndpoint(endpoint: Endpoint) {
    if (useSqlite) {
      const stmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO endpoints (id, name, url, interval, status, lastCheck, errorCount, consecutiveErrors, authType, authConfig, responseTimeHistory, timeout)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        endpoint.id,
        endpoint.name,
        endpoint.url,
        endpoint.interval,
        endpoint.status,
        endpoint.lastCheck || null,
        endpoint.errorCount,
        endpoint.consecutiveErrors,
        endpoint.authType,
        JSON.stringify(endpoint.authConfig),
        JSON.stringify(endpoint.responseTimeHistory || []),
        endpoint.timeout !== undefined ? endpoint.timeout : null
      )
    } else {
      const endpoints = this.getEndpoints()
      const index = endpoints.findIndex((e) => e.id === endpoint.id)
      if (index > -1) {
        endpoints[index] = endpoint
      } else {
        endpoints.push(endpoint)
      }
      store.set('endpoints', endpoints)
    }
  },

  deleteEndpoint(id: string) {
    if (useSqlite) {
      dbInstance.prepare('DELETE FROM endpoints WHERE id = ?').run(id)
      dbInstance.prepare('DELETE FROM alerts WHERE endpointId = ?').run(id)
      dbInstance.prepare('DELETE FROM logs WHERE endpointId = ?').run(id)
    } else {
      const endpoints = this.getEndpoints().filter((e) => e.id !== id)
      store.set('endpoints', endpoints)
      this.deleteAlertsForEndpoint(id)
    }
  },

  // Alerts
  getAlerts(): Alert[] {
    if (useSqlite) {
      const rows = dbInstance.prepare('SELECT * FROM alerts').all()
      return rows.map((row: any) => ({
        ...row,
        read: row.read === 1
      }))
    } else {
      return (store.get('alerts') as Alert[]) || []
    }
  },

  saveAlert(alert: Alert) {
    if (useSqlite) {
      const stmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO alerts (id, endpointId, endpointName, message, timestamp, read)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      stmt.run(alert.id, alert.endpointId, alert.endpointName, alert.message, alert.timestamp, alert.read ? 1 : 0)
    } else {
      const alerts = this.getAlerts()
      alerts.push(alert)
      store.set('alerts', alerts)
    }
  },

  markAlertAsRead(id: string) {
    if (useSqlite) {
      dbInstance.prepare('UPDATE alerts SET read = 1 WHERE id = ?').run(id)
    } else {
      const alerts = this.getAlerts().map((a) => (a.id === id ? { ...a, read: true } : a))
      store.set('alerts', alerts)
    }
  },

  archiveAlerts() {
    if (useSqlite) {
      dbInstance.prepare('UPDATE alerts SET read = 1').run()
    } else {
      const alerts = this.getAlerts().map((a) => ({ ...a, read: true }))
      store.set('alerts', alerts)
    }
  },

  clearAllAlerts() {
    if (useSqlite) {
      dbInstance.prepare('DELETE FROM alerts').run()
    } else {
      store.set('alerts', [])
    }
  },

  deleteAlert(id: string) {
    if (useSqlite) {
      dbInstance.prepare('DELETE FROM alerts WHERE id = ?').run(id)
    } else {
      const alerts = this.getAlerts().filter((a) => a.id !== id)
      store.set('alerts', alerts)
    }
  },

  deleteAlertsForEndpoint(endpointId: string) {
    if (!useSqlite) {
      const alerts = this.getAlerts().filter((a) => a.endpointId !== endpointId)
      store.set('alerts', alerts)
    }
  },

  // Logs
  getLogs(): Log[] {
    if (useSqlite) {
      const rows = dbInstance.prepare('SELECT * FROM logs').all()
      return rows.map((row: any) => ({
        ...row,
        success: row.success === 1
      }))
    } else {
      return (store.get('logs') as Log[]) || []
    }
  },

  saveLog(log: Log) {
    if (useSqlite) {
      const stmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO logs (id, endpointId, endpointName, message, timestamp, type, success)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(log.id, log.endpointId || null, log.endpointName || null, log.message, log.timestamp, log.type, log.success ? 1 : 0)
    } else {
      const logs = this.getLogs()
      logs.push(log)
      store.set('logs', logs)
    }
  },

  clearLogs() {
    if (useSqlite) {
      dbInstance.prepare('DELETE FROM logs WHERE type = "xerox"').run()
    } else {
      const logs = this.getLogs().filter((l) => l.type !== 'xerox')
      store.set('logs', logs)
    }
  },

  exportBackup(): string {
    const data = {
      endpoints: this.getEndpoints(),
      alerts: this.getAlerts(),
      logs: this.getLogs()
    }
    return JSON.stringify(data, null, 2)
  },

  importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString)
      if (parsed.endpoints && Array.isArray(parsed.endpoints)) {
        if (useSqlite) {
          dbInstance.prepare('DELETE FROM endpoints').run()
          dbInstance.prepare('DELETE FROM alerts').run()
          dbInstance.prepare('DELETE FROM logs').run()
        } else {
          store.set('endpoints', [])
          store.set('alerts', [])
          store.set('logs', [])
        }
        
        parsed.endpoints.forEach((ep: Endpoint) => this.saveEndpoint(ep))
        if (parsed.alerts && Array.isArray(parsed.alerts)) {
          parsed.alerts.forEach((al: Alert) => this.saveAlert(al))
        }
        if (parsed.logs && Array.isArray(parsed.logs)) {
          parsed.logs.forEach((lo: Log) => this.saveLog(lo))
        }
        return true
      }
      return false
    } catch {
      return false
    }
  },

  resetAllData() {
    if (useSqlite) {
      dbInstance.prepare('DELETE FROM endpoints').run()
      dbInstance.prepare('DELETE FROM alerts').run()
      dbInstance.prepare('DELETE FROM logs').run()
    } else {
      store.set('endpoints', [])
      store.set('alerts', [])
      store.set('logs', [])
    }
  },

  clearDemoData() {
    if (useSqlite) {
      dbInstance.prepare("DELETE FROM endpoints WHERE id LIKE 'seed-%'").run()
      dbInstance.prepare("DELETE FROM alerts WHERE id LIKE 'sa-%' OR endpointId LIKE 'seed-%'").run()
      dbInstance.prepare("DELETE FROM logs WHERE id LIKE 'sl-%' OR endpointId LIKE 'seed-%'").run()
    } else {
      const endpoints = (store.get('endpoints') as Endpoint[] || []).filter((e) => !e.id.startsWith('seed-'))
      store.set('endpoints', endpoints)
      const alerts = (store.get('alerts') as Alert[] || []).filter((a) => !a.id.startsWith('sa-') && !a.endpointId.startsWith('seed-'))
      store.set('alerts', alerts)
      const logs = (store.get('logs') as Log[] || []).filter((l) => !l.id.startsWith('sl-') && !l.endpointId?.startsWith('seed-'))
      store.set('logs', logs)
    }
  },

  seedDemoData(mode: 'green' | 'mixed') {
    this.clearDemoData()
    const t = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()
    const seedEndpoints: Endpoint[] = [
      {
        id: 'seed-1',
        name: 'ERP Sales API',
        url: 'https://api.xerox.com/v1/sales',
        interval: 1,
        status: 'success',
        lastCheck: t(2),
        errorCount: 0,
        consecutiveErrors: 0,
        authType: 'oauth2',
        authConfig: { type: 'oauth2', clientId: 'app_123', clientSecret: '***', tokenUrl: 'https://oauth.xerox.com/token' },
        responseTimeHistory: [120, 135, 125, 140, 130],
        timeout: 10
      },
      {
        id: mode === 'mixed' ? 'seed-error-1' : 'seed-2',
        name: 'HR Portal Service',
        url: 'http://10.0.0.15/api/health',
        interval: 1,
        status: mode === 'mixed' ? 'error' : 'success',
        lastCheck: t(8),
        errorCount: mode === 'mixed' ? 10 : 0,
        consecutiveErrors: mode === 'mixed' ? 3 : 0,
        authType: 'ntlm',
        authConfig: { type: 'ntlm', username: 'svc_monitor', password: '***', domain: 'XEROX' },
        responseTimeHistory: mode === 'mixed' ? [5000] : [220, 240, 215, 230, 225],
        timeout: 15
      },
      {
        id: mode === 'mixed' ? 'seed-error-2' : 'seed-3',
        name: 'Finance Reporting',
        url: 'https://finance.xerox.internal/api/reports',
        interval: 1,
        status: mode === 'mixed' ? 'error' : 'success',
        lastCheck: t(1),
        errorCount: mode === 'mixed' ? 15 : 0,
        consecutiveErrors: mode === 'mixed' ? 5 : 0,
        authType: 'basic',
        authConfig: { type: 'basic', username: 'monitor_svc', password: '***' },
        responseTimeHistory: mode === 'mixed' ? [5000] : [88, 94, 101, 97, 85, 90, 92],
        timeout: 30
      },
      {
        id: 'seed-4',
        name: 'Inventory Sync',
        url: 'http://inventory.xerox.local:7777/api/stock',
        interval: 1,
        status: 'success',
        lastCheck: t(5),
        errorCount: 0,
        consecutiveErrors: 0,
        authType: 'none',
        authConfig: { type: 'none' },
        responseTimeHistory: [310, 298, 322, 315],
        timeout: 10
      }
    ]
    seedEndpoints.forEach((ep) => this.saveEndpoint(ep))
  }
}

// Run initial database seed - always overwrite seed endpoints with fully online/working status
try {
  console.log('Seeding initial demo database endpoints, alerts, and logs (fully online)...')
  
  // Clean up any existing seed data to force a fresh seed of fully green endpoints
  if (useSqlite) {
    dbInstance.prepare("DELETE FROM endpoints WHERE id LIKE 'seed-%'").run()
    dbInstance.prepare("DELETE FROM alerts WHERE id LIKE 'sa-%' or endpointId LIKE 'seed-%'").run()
    dbInstance.prepare("DELETE FROM logs WHERE id LIKE 'sl-%' or endpointId LIKE 'seed-%'").run()
  } else {
    const endpoints = (store.get('endpoints') as Endpoint[] || []).filter((e) => !e.id.startsWith('seed-'))
    store.set('endpoints', endpoints)
    const alerts = (store.get('alerts') as Alert[] || []).filter((a) => !a.id.startsWith('sa-') && !a.endpointId.startsWith('seed-'))
    store.set('alerts', alerts)
    const logs = (store.get('logs') as Log[] || []).filter((l) => !l.id.startsWith('sl-') && !l.endpointId?.startsWith('seed-'))
    store.set('logs', logs)
  }

  const NOW = new Date()
  const t = (offsetMinutes: number) => new Date(NOW.getTime() - offsetMinutes * 60000).toISOString()

  const seedEndpoints: Endpoint[] = [
    {
      id: 'seed-1',
      name: 'ERP Sales API',
      url: 'http://erp-server.xerox.local:8080/api/sales',
      interval: 5,
      status: 'success',
      lastCheck: t(2),
      errorCount: 0,
      consecutiveErrors: 0,
      authType: 'apiKey',
      authConfig: { type: 'apiKey', key: 'X-API-Key', value: '***', location: 'header' },
      responseTimeHistory: [120, 135, 118, 142, 127, 110, 131],
      timeout: 10
    },
    {
      id: 'seed-2',
      name: 'HR Portal Service',
      url: 'http://hr-portal.xerox.local:9090/api/employees',
      interval: 10,
      status: 'success',
      lastCheck: t(8),
      errorCount: 0,
      consecutiveErrors: 0,
      authType: 'ntlm',
      authConfig: { type: 'ntlm', username: 'svc_monitor', password: '***', domain: 'XEROX' },
      responseTimeHistory: [220, 240, 215, 230, 225],
      timeout: 15
    },
    {
      id: 'seed-3',
      name: 'Finance Reporting',
      url: 'https://finance.xerox.internal/api/reports',
      interval: 15,
      status: 'success',
      lastCheck: t(1),
      errorCount: 0,
      consecutiveErrors: 0,
      authType: 'basic',
      authConfig: { type: 'basic', username: 'monitor_svc', password: '***' },
      responseTimeHistory: [88, 94, 101, 97, 85, 90, 92],
      timeout: 30
    },
    {
      id: 'seed-4',
      name: 'Inventory Sync',
      url: 'http://inventory.xerox.local:7777/api/stock',
      interval: 5,
      status: 'success',
      lastCheck: t(5),
      errorCount: 0,
      consecutiveErrors: 0,
      authType: 'none',
      authConfig: { type: 'none' },
      responseTimeHistory: [310, 298, 322, 315],
      timeout: 10
    }
  ]

  // No active alerts, but we can seed some read alerts from history
  const seedAlerts: Alert[] = [
    { id: 'sa-3', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'HTTP 503 Service Unavailable (Resolved)', timestamp: t(45), read: true },
    { id: 'sa-4', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'Response time spike detected — 540ms (Resolved)', timestamp: t(60), read: true },
    { id: 'sa-5', endpointId: 'seed-3', endpointName: 'Finance Reporting', message: 'HTTP 401 Unauthorized (Resolved)', timestamp: t(120), read: true }
  ]

  const seedLogs: Log[] = [
    { id: 'sl-1', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'HTTP 200 OK — 127ms', timestamp: t(2), type: 'info' },
    { id: 'sl-2', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'HTTP 200 OK — 225ms', timestamp: t(8), type: 'info' },
    { id: 'sl-3', endpointId: 'seed-3', endpointName: 'Finance Reporting', message: 'HTTP 200 OK — 90ms', timestamp: t(1), type: 'info' },
    { id: 'sl-4', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'Xerox audit log exported — 48 records copied', timestamp: t(15), type: 'xerox', success: true },
    { id: 'sl-5', endpointId: 'seed-2', endpointName: 'HR Portal Service', message: 'Xerox audit log exported — 25 records copied', timestamp: t(45), type: 'xerox', success: true },
    { id: 'sl-6', endpointId: 'seed-3', endpointName: 'Finance Reporting', message: 'Xerox audit log exported — 12 records copied', timestamp: t(30), type: 'xerox', success: true },
    { id: 'sl-7', endpointId: 'seed-4', endpointName: 'Inventory Sync', message: 'HTTP 200 OK — 315ms', timestamp: t(5), type: 'info' },
    { id: 'sl-8', endpointId: 'seed-1', endpointName: 'ERP Sales API', message: 'HTTP 200 OK — 131ms', timestamp: t(7), type: 'info' }
  ]

  seedEndpoints.forEach((ep) => DatabaseService.saveEndpoint(ep))
  seedAlerts.forEach((al) => DatabaseService.saveAlert(al))
  seedLogs.forEach((lg) => DatabaseService.saveLog(lg))
  console.log('Seeded database with fully working demo data successfully.')
} catch (e) {
  console.error('Failed to run initial database seeding:', e)
}

// Run initial log purge on startup
try {
  setTimeout(() => {
    DatabaseService.purgeOldLogs()
  }, 5000)
} catch (e) {
  console.error('Failed to run startup log purge:', e)
}

export default DatabaseService
