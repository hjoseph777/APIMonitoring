import { app, safeStorage } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { Endpoint, Alert, Log } from '../src/types'
import { validateBackupPayload } from './lib/backupValidation'

// We will attempt to use better-sqlite3, but fallback to electron-store if native compilation is missing or fails.
let dbInstance: any = null
let useSqlite = false
const store = new Store()

try {
  // require(), not import — this must be inside a try/catch so a missing/failed
  // native build falls back to electron-store, which a hoisted static import can't do.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
      timeout INTEGER,
      allow_self_signed INTEGER DEFAULT 0,
      monitoring_paused INTEGER DEFAULT 0
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
  } catch {
    // Column already exists, ignore
  }

  try {
    dbInstance.exec('ALTER TABLE endpoints ADD COLUMN allow_self_signed INTEGER DEFAULT 0;')
  } catch {
    // Column already exists, ignore
  }

  try {
    dbInstance.exec('ALTER TABLE endpoints ADD COLUMN monitoring_paused INTEGER DEFAULT 0;')
  } catch {
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
        // Also cap total log count to prevent unbounded growth from high-frequency endpoints
        dbInstance.prepare(`DELETE FROM logs WHERE id NOT IN (
          SELECT id FROM logs ORDER BY timestamp DESC LIMIT 5000
        )`).run()
        console.log('Database logs and alerts older than 7 days purged.')
      } else {
        const logs = (store.get('logs') as Log[]) || []
        const filteredLogs = logs.filter((l: Log) => l.timestamp >= cutOffDate).slice(-5000)
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
    const parseAuthConfig = (configStr: string) => {
      try {
        if (configStr.startsWith('enc:')) {
          if (safeStorage.isEncryptionAvailable()) {
            return JSON.parse(safeStorage.decryptString(Buffer.from(configStr.substring(4), 'base64')))
          } else {
            console.warn('[security] Cannot decrypt authConfig, encryption unavailable')
            return {}
          }
        }
        return JSON.parse(configStr) // Legacy plaintext fallback
      } catch (err) {
        console.error('[security] Failed to parse authConfig:', err)
        return {}
      }
    }

    if (useSqlite) {
      const rows = dbInstance.prepare('SELECT * FROM endpoints').all()
      return rows.map((row: any) => ({
        ...row,
        allowSelfSigned: row.allow_self_signed === 1,
        monitoringPaused: row.monitoring_paused === 1,
        responseTimeHistory: row.responseTimeHistory ? JSON.parse(row.responseTimeHistory) : [],
        authConfig: parseAuthConfig(row.authConfig)
      }))
    } else {
      const endpoints = (store.get('endpoints') as Endpoint[]) || []
      // Parse electron-store authConfigs if we were to encrypt them there too, 
      // but in this codebase, electron-store fallback is just for testing.
      // However, we apply the same parsing to be safe if they ever get encrypted there.
      return endpoints.map(ep => {
        if (typeof ep.authConfig === 'string') {
           ep.authConfig = parseAuthConfig(ep.authConfig)
        }
        return ep
      })
    }
  },

  saveEndpoint(endpoint: Endpoint) {
    const serializeAuthConfig = (config: any) => {
      const plainStr = JSON.stringify(config)
      if (safeStorage.isEncryptionAvailable()) {
        return 'enc:' + safeStorage.encryptString(plainStr).toString('base64')
      }
      return plainStr
    }

    if (useSqlite) {
      const stmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO endpoints (id, name, url, interval, status, lastCheck, errorCount, consecutiveErrors, authType, authConfig, responseTimeHistory, timeout, allow_self_signed, monitoring_paused)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        serializeAuthConfig(endpoint.authConfig),
        JSON.stringify(endpoint.responseTimeHistory || []),
        endpoint.timeout !== undefined ? endpoint.timeout : null,
        endpoint.allowSelfSigned ? 1 : 0,
        endpoint.monitoringPaused ? 1 : 0
      )
    } else {
      // For electron-store, we can keep the object as is since store handles it,
      // or stringify/encrypt it. Let's encrypt it to be consistent with enterprise requirements.
      // IMPORTANT: read/write the raw stored array here, not this.getEndpoints() — that
      // method decrypts every entry's authConfig back into a plaintext object, and
      // persisting that result would silently re-write every sibling endpoint's
      // credentials as decrypted plaintext on every single save.
      const epToSave = { ...endpoint, authConfig: serializeAuthConfig(endpoint.authConfig) }
      const rawEndpoints = (store.get('endpoints') as any[]) || []
      const index = rawEndpoints.findIndex((e) => e.id === epToSave.id)
      if (index > -1) {
        rawEndpoints[index] = epToSave
      } else {
        rawEndpoints.push(epToSave)
      }
      store.set('endpoints', rawEndpoints)
    }
  },

  deleteEndpoint(id: string) {
    if (useSqlite) {
      dbInstance.prepare('DELETE FROM endpoints WHERE id = ?').run(id)
      dbInstance.prepare('DELETE FROM alerts WHERE endpointId = ?').run(id)
      dbInstance.prepare('DELETE FROM logs WHERE endpointId = ?').run(id)
    } else {
      // Filter the raw stored array, not this.getEndpoints() — see saveEndpoint for why:
      // that method decrypts authConfig for every entry, and persisting the result would
      // re-write every surviving endpoint's credentials as decrypted plaintext.
      const rawEndpoints = ((store.get('endpoints') as any[]) || []).filter((e) => e.id !== id)
      store.set('endpoints', rawEndpoints)
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
      // Return the 500 most recent log entries to prevent unbounded IPC payload size
      const rows = dbInstance.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500').all()
      return rows.map((row: any) => ({
        ...row,
        success: row.success === 1
      }))
    } else {
      return ((store.get('logs') as Log[]) || []).slice(-500)
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
      dbInstance.prepare('DELETE FROM logs').run()
    } else {
      store.set('logs', [])
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
      const result = validateBackupPayload(parsed)
      if (!result.valid) {
        console.warn('[import] Rejected backup payload:', result.reason)
        return false
      }
      const { endpoints, alerts, logs } = result.value

      if (useSqlite) {
        dbInstance.prepare('DELETE FROM endpoints').run()
        dbInstance.prepare('DELETE FROM alerts').run()
        dbInstance.prepare('DELETE FROM logs').run()
      } else {
        store.set('endpoints', [])
        store.set('alerts', [])
        store.set('logs', [])
      }

      endpoints.forEach((ep: Endpoint) => this.saveEndpoint(ep))
      if (alerts) {
        alerts.forEach((al: Alert) => this.saveAlert(al))
      }
      if (logs) {
        logs.forEach((lo: Log) => this.saveLog(lo))
      }
      return true
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

  seedDemoData(mode: 'green' | 'mixed' | 'lockout') {
    this.clearDemoData()
    const t = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()

    // 'lockout' demonstrates AD Lockout Protection: NTLM/Basic endpoints that fail
    // auth are shown Paused (monitoringPaused), while a non-eligible auth type
    // (OAuth2) that fails is shown as a plain Down — the same distinction the
    // real circuit breaker draws by authType.
    const erpStatus = mode === 'lockout' ? 'error' : 'success'
    const hrOrFinanceFails = mode === 'mixed' || mode === 'lockout'

    const seedEndpoints: Endpoint[] = [
      {
        id: mode === 'lockout' ? 'seed-lockout-1' : 'seed-1',
        name: 'ERP Sales API',
        url: 'https://api.xerox.com/v1/sales',
        interval: 1,
        status: erpStatus,
        lastCheck: t(2),
        errorCount: mode === 'lockout' ? 4 : 0,
        consecutiveErrors: mode === 'lockout' ? 4 : 0,
        authType: 'oauth2',
        authConfig: { type: 'oauth2', clientId: 'app_123', clientSecret: '***', tokenUrl: 'https://oauth.xerox.com/token' },
        responseTimeHistory: mode === 'lockout' ? [5000] : [120, 135, 125, 140, 130],
        timeout: 10
      },
      {
        id: hrOrFinanceFails ? 'seed-error-1' : 'seed-2',
        name: 'HR Portal Service',
        url: 'http://10.0.0.15/api/health',
        interval: 1,
        status: hrOrFinanceFails ? 'error' : 'success',
        lastCheck: t(8),
        errorCount: hrOrFinanceFails ? 10 : 0,
        consecutiveErrors: hrOrFinanceFails ? 3 : 0,
        authType: 'ntlm',
        authConfig: { type: 'ntlm', username: 'svc_monitor', password: '***', domain: 'XEROX' },
        responseTimeHistory: hrOrFinanceFails ? [5000] : [220, 240, 215, 230, 225],
        timeout: 15,
        monitoringPaused: mode === 'lockout'
      },
      {
        id: hrOrFinanceFails ? 'seed-error-2' : 'seed-3',
        name: 'Finance Reporting',
        url: 'https://finance.xerox.internal/api/reports',
        interval: 1,
        status: hrOrFinanceFails ? 'error' : 'success',
        lastCheck: t(1),
        errorCount: hrOrFinanceFails ? 15 : 0,
        consecutiveErrors: hrOrFinanceFails ? 5 : 0,
        authType: 'basic',
        authConfig: { type: 'basic', username: 'monitor_svc', password: '***' },
        responseTimeHistory: hrOrFinanceFails ? [5000] : [88, 94, 101, 97, 85, 90, 92],
        timeout: 30,
        monitoringPaused: mode === 'lockout'
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

    // Seed matching logs/alerts directly, deterministically — seed endpoints are no
    // longer placed on the live check loop (see MonitoringService.schedule), so
    // nothing would otherwise ever populate the Recent Activity / Active Alerts
    // feeds for them. "Seed data" should be a complete static snapshot, not
    // something that depends on a live check to fill in the rest.
    const lockoutMessage = 'Authentication rejected (401/403) — AD Lockout Protection engaged, automatic checks paused for this endpoint until it is rechecked or re-saved.'
    // HR Portal Service / Finance Reporting share the same failure wording in a
    // given mode — the real threshold-alert text for 'mixed', the real lockout
    // text for 'lockout'.
    const hrFinanceFailureDetail = mode === 'lockout' ? lockoutMessage : 'Simulated 503 Service Unavailable'

    const seedLogs: Log[] = [
      {
        id: 'sl-1',
        endpointId: seedEndpoints[0].id,
        endpointName: seedEndpoints[0].name,
        message: erpStatus === 'success' ? 'Reachable. Latency: 130ms.' : 'Failure check: timeout',
        timestamp: t(2),
        type: erpStatus === 'success' ? 'info' : 'error'
      },
      {
        id: 'sl-2',
        endpointId: seedEndpoints[1].id,
        endpointName: seedEndpoints[1].name,
        message: hrOrFinanceFails ? `Failure check: ${hrFinanceFailureDetail}` : 'Reachable. Latency: 225ms.',
        timestamp: t(8),
        type: hrOrFinanceFails ? 'error' : 'info'
      },
      {
        id: 'sl-3',
        endpointId: seedEndpoints[2].id,
        endpointName: seedEndpoints[2].name,
        message: hrOrFinanceFails ? `Failure check: ${hrFinanceFailureDetail}` : 'Reachable. Latency: 92ms.',
        timestamp: t(1),
        type: hrOrFinanceFails ? 'error' : 'info'
      },
      {
        id: 'sl-4',
        endpointId: seedEndpoints[3].id,
        endpointName: seedEndpoints[3].name,
        message: 'Reachable. Latency: 315ms.',
        timestamp: t(5),
        type: 'info'
      }
    ]
    seedLogs.forEach((lo) => this.saveLog(lo))

    const seedAlerts: Alert[] = []
    if (mode !== 'green') {
      seedAlerts.push(
        {
          id: 'sa-1',
          endpointId: seedEndpoints[1].id,
          endpointName: seedEndpoints[1].name,
          message: mode === 'lockout' ? lockoutMessage : 'Failed checks consecutive threshold hit (3 failures).',
          timestamp: t(8),
          read: false
        },
        {
          id: 'sa-2',
          endpointId: seedEndpoints[2].id,
          endpointName: seedEndpoints[2].name,
          message: mode === 'lockout' ? lockoutMessage : 'Failed checks consecutive threshold hit (5 failures).',
          timestamp: t(1),
          read: false
        }
      )
    }
    if (mode === 'lockout') {
      seedAlerts.push({
        id: 'sa-3',
        endpointId: seedEndpoints[0].id,
        endpointName: seedEndpoints[0].name,
        message: 'Failed checks consecutive threshold hit (4 failures).',
        timestamp: t(2),
        read: false
      })
    }
    seedAlerts.forEach((al) => this.saveAlert(al))
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
