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
      responseTimeHistory TEXT
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
        INSERT OR REPLACE INTO endpoints (id, name, url, interval, status, lastCheck, errorCount, consecutiveErrors, authType, authConfig, responseTimeHistory)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(endpoint.responseTimeHistory || [])
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
  }
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
