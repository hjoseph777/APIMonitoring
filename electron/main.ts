import { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage, safeStorage } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import axios from 'axios'
import * as fs from 'fs'
import * as tls from 'tls'
import Store from 'electron-store'
import nodemailer from 'nodemailer'
import DatabaseService from './database'
import MonitoringService from './monitoring'
import { Endpoint } from '../src/types'
import { DEFAULT_SETTINGS, parseAndValidateSettings } from './lib/settingsSchema'
import { validateWebhookUrl } from './lib/webhookGuard'

let isQuitting = false

// Module-level electron-store singleton
// electron-store's Conf<T> defaults T to Record<string, unknown>, which makes every
// .get() call return `unknown` and forces a cast at each call site. This store holds
// a loose mix of AppSettings fields plus internal bookkeeping keys (lastExportTime,
// smtpPassEncrypted, etc.), so Record<string, any> is the honest shape here — not
// every key is worth its own generic.
const mainStore = new Store<Record<string, any>>()

import { ICON_IDLE, ICON_ONLINE, ICON_WARNING, ICON_OFFLINE } from './icons_b64'

const getIcon = (status: 'online' | 'warning' | 'offline' | 'idle') => {
  let dataUrl = ICON_IDLE
  if (status === 'online') dataUrl = ICON_ONLINE
  if (status === 'warning') dataUrl = ICON_WARNING
  if (status === 'offline') dataUrl = ICON_OFFLINE
  return nativeImage.createFromDataURL(dataUrl)
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const appIcon = getIcon('idle')

// Enforce single instance lock globally to prevent duplicate tray icons and background monitoring
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// --- Security helpers (P16-6: SMTP password encryption, P16-7: Webhook SSRF guard) ---
// Note: validateWebhookUrl lives in ./lib/webhookGuard.ts (pure, unit-tested);
// AppSettings/DEFAULT_SETTINGS/parseAndValidateSettings live in ./lib/settingsSchema.ts.

/**
 * Reads and decrypts the SMTP password from the settings store.
 * Transparently migrates legacy plaintext entries to encrypted on first access.
 */
function getDecryptedSmtpPass(): string {
  const encryptedB64 = mainStore.get('smtpPassEncrypted', '') as string
  if (encryptedB64) {
    try {
      return safeStorage.decryptString(Buffer.from(encryptedB64, 'base64'))
    } catch {
      return ''
    }
  }
  // Legacy migration: if a plaintext smtpPass exists, encrypt it on the fly
  const legacy = mainStore.get('smtpPass', '') as string
  if (legacy && safeStorage.isEncryptionAvailable()) {
    try {
      mainStore.set('smtpPassEncrypted', safeStorage.encryptString(legacy).toString('base64'))
      mainStore.delete('smtpPass')
    } catch { /* migration failed — will be cleared on next explicit save */ }
    return legacy
  }
  return legacy
}

/**
 * Encrypts and persists the SMTP password.
 * Always removes any legacy plaintext entry regardless of outcome.
 */
function setEncryptedSmtpPass(plaintext: string): void {
  mainStore.delete('smtpPass') // always remove legacy plaintext key
  if (!plaintext) {
    mainStore.delete('smtpPassEncrypted')
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('[security] safeStorage unavailable — SMTP password not persisted')
    return
  }
  try {
    mainStore.set('smtpPassEncrypted', safeStorage.encryptString(plaintext).toString('base64'))
  } catch (e) {
    console.error('[security] Failed to encrypt SMTP password:', e)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 550,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const win = mainWindow
  win.setMenuBarVisibility(false)

  win.on('close', (event) => {
    if (!isQuitting && mainStore.get('minimizeTray', true)) {
      event.preventDefault()
      win.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Shared by the scheduled weekly auto-export and the on-demand "Export CSV" button on Reports
function buildLogsCsv(): string {
  const logs = DatabaseService.getLogs()
  const headers = ['Timestamp', 'Type', 'Status', 'Message', 'Endpoint']
  return [
    headers.join(','),
    ...logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.type}"`,
      `"${l.success ? 'Success' : 'Error'}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      `"${(l.endpointName || '').replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n')
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.name)
  }

  if (mainStore.get('autoUpdatesEnabled', false)) {
    try {
      autoUpdater.checkForUpdatesAndNotify()
    } catch (e) {
      console.error('Failed to check for updates:', e)
    }
  }

  // Start background monitoring service
  MonitoringService.start()

  // Start background log exporter
  setInterval(() => {
    try {
      if (mainStore.get('autoExportLogs', false)) {
        const exportPath = mainStore.get('exportPath', '')
        if (exportPath && fs.existsSync(exportPath)) {
          const lastExportTime = mainStore.get('lastExportTime', 0)
          // 7 days = 604800000 ms
          if (Date.now() - lastExportTime > 604800000) {
            const logs = DatabaseService.getLogs()
            if (logs.length > 0) {
              const csv = buildLogsCsv()
              const filename = `api_monitor_logs_${new Date().toISOString().split('T')[0]}.csv`
              fs.writeFileSync(join(exportPath, filename), csv)
              mainStore.set('lastExportTime', Date.now())
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to auto-export logs:', err)
    }
  }, 1000 * 60 * 60) // Check every hour

  // Register IPC handlers
  ipcMain.handle('get-endpoints', () => DatabaseService.getEndpoints())
  
  ipcMain.handle('save-endpoint', (_, endpoint: Endpoint) => {
    DatabaseService.saveEndpoint(endpoint)
    MonitoringService.schedule(endpoint) // Schedule/re-schedule
    updateTrayMenu()
    return { success: true }
  })

  ipcMain.handle('delete-endpoint', (_, id: string) => {
    MonitoringService.unschedule(id)
    DatabaseService.deleteEndpoint(id)
    updateTrayMenu()
    return { success: true }
  })

  ipcMain.handle('refresh-endpoint', async (_, id: string) => {
    const halted = await MonitoringService.checkEndpoint(id)
    // If AD Lockout Protection had previously halted this endpoint's loop and this
    // manual recheck didn't hit the same lockout, resume automatic monitoring —
    // otherwise a fixed credential would leave the endpoint stuck unmonitored
    // until it's edited and re-saved.
    if (!halted && !MonitoringService.isScheduled(id)) {
      const endpoint = DatabaseService.getEndpoints().find(e => e.id === id)
      if (endpoint) MonitoringService.schedule(endpoint)
    }
    updateTrayMenu()
    return { success: true }
  })

  ipcMain.handle('get-alerts', () => DatabaseService.getAlerts())
  ipcMain.handle('clear-all-alerts', () => {
    DatabaseService.clearAllAlerts()
    return { success: true }
  })
  ipcMain.handle('delete-alert', (_, id: string) => {
    DatabaseService.deleteAlert(id)
    return { success: true }
  })
  ipcMain.handle('mark-alert-as-read', (_, id: string) => {
    DatabaseService.markAlertAsRead(id)
    return { success: true }
  })
  ipcMain.handle('archive-alerts', () => {
    DatabaseService.archiveAlerts()
    return { success: true }
  })

  ipcMain.handle('get-logs', () => DatabaseService.getLogs())
  ipcMain.handle('export-logs-csv', () => buildLogsCsv())
  ipcMain.handle('clear-logs', () => {
    DatabaseService.clearLogs()
    return { success: true }
  })

  // Clipboard copy
  ipcMain.handle('copy-to-clipboard', (_, { text }) => {
    let success = false
    try {
      clipboard.writeText(text)
      success = true
    } catch {
      success = false
    }
    return { success }
  })

  // Certificate validator — P16-8: actually parses the PFX with the provided passphrase
  ipcMain.handle('validate-certificate', (_, { path, passphrase }) => {
    try {
      if (!fs.existsSync(path)) return false
      const pfxData = fs.readFileSync(path)
      tls.createSecureContext({ pfx: pfxData, passphrase: passphrase || '' })
      return true
    } catch {
      return false
    }
  })

  // Auth tester
  ipcMain.handle('test-authentication', async (_, { endpointId }) => {
    const endpoints = DatabaseService.getEndpoints()
    const endpoint = endpoints.find((e) => e.id === endpointId)
    if (!endpoint) throw new Error('Endpoint not found')
    await MonitoringService.checkEndpoint(endpointId)
    return { status: 200 }
  })

  ipcMain.handle('test-connection', async (_, endpoint: Partial<Endpoint>) => {
    return await MonitoringService.testConnection(endpoint)
  })

  // Backup and restore operations
  ipcMain.handle('export-backup', () => DatabaseService.exportBackup())
  ipcMain.handle('import-backup', (_, jsonString: string) => {
    const success = DatabaseService.importBackup(jsonString)
    if (success) {
      MonitoringService.scheduleAll()
    }
    return { success }
  })
  ipcMain.handle('reset-all-data', () => {
    DatabaseService.resetAllData()
    return { success: true }
  })

  // Demonstration / Seeding operations
  ipcMain.handle('seed-demo-data', (_, mode: 'green' | 'mixed') => {
    try {
      DatabaseService.seedDemoData(mode)
      MonitoringService.scheduleAll()
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('clear-demo-data', () => {
    try {
      DatabaseService.clearDemoData()
      MonitoringService.scheduleAll()
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })

  // Global settings
  ipcMain.handle('get-settings', () => {
    return {
      nativeNotify: mainStore.get('nativeNotify', DEFAULT_SETTINGS.nativeNotify),
      smtpServer: mainStore.get('smtpServer', DEFAULT_SETTINGS.smtpServer),
      smtpPort: mainStore.get('smtpPort', DEFAULT_SETTINGS.smtpPort),
      smtpUser: mainStore.get('smtpUser', DEFAULT_SETTINGS.smtpUser),
      smtpPass: getDecryptedSmtpPass(),
      notifyEmail: mainStore.get('notifyEmail', DEFAULT_SETTINGS.notifyEmail),
      globalWebhook: mainStore.get('globalWebhook', DEFAULT_SETTINGS.globalWebhook),
      globalWebhookChannel: mainStore.get('globalWebhookChannel', DEFAULT_SETTINGS.globalWebhookChannel),
      runAtStartup: mainStore.get('runAtStartup', DEFAULT_SETTINGS.runAtStartup),
      maintenanceMode: mainStore.get('maintenanceMode', DEFAULT_SETTINGS.maintenanceMode),
      autoExportLogs: mainStore.get('autoExportLogs', DEFAULT_SETTINGS.autoExportLogs),
      exportPath: mainStore.get('exportPath', DEFAULT_SETTINGS.exportPath),
      autoUpdatesEnabled: mainStore.get('autoUpdatesEnabled', DEFAULT_SETTINGS.autoUpdatesEnabled),
      alertThreshold: mainStore.get('alertThreshold', DEFAULT_SETTINGS.alertThreshold),
      smtpAllowSelfSigned: mainStore.get('smtpAllowSelfSigned', DEFAULT_SETTINGS.smtpAllowSelfSigned),
      minimizeTray: mainStore.get('minimizeTray', DEFAULT_SETTINGS.minimizeTray)
    }
  })

  ipcMain.handle('save-settings', (_, settings: unknown) => {
    const parsed = parseAndValidateSettings(settings)
    if (!parsed.ok) {
      return { success: false, message: parsed.message }
    }

    const safeSettings = parsed.value

    // P16-7: Validate webhook URL before persisting (SSRF guard)
    if (safeSettings.globalWebhook) {
      const webhookCheck = validateWebhookUrl(safeSettings.globalWebhook)
      if (!webhookCheck.valid) {
        return { success: false, message: `Webhook URL rejected: ${webhookCheck.reason}` }
      }
    }

    mainStore.set('nativeNotify', safeSettings.nativeNotify)
    mainStore.set('smtpServer', safeSettings.smtpServer)
    mainStore.set('smtpPort', safeSettings.smtpPort)
    mainStore.set('smtpUser', safeSettings.smtpUser)
    setEncryptedSmtpPass(safeSettings.smtpPass)
    mainStore.set('notifyEmail', safeSettings.notifyEmail)
    mainStore.set('globalWebhook', safeSettings.globalWebhook)
    mainStore.set('globalWebhookChannel', safeSettings.globalWebhookChannel)
    mainStore.set('runAtStartup', safeSettings.runAtStartup)
    mainStore.set('maintenanceMode', safeSettings.maintenanceMode)
    mainStore.set('autoExportLogs', safeSettings.autoExportLogs)
    mainStore.set('exportPath', safeSettings.exportPath)
    mainStore.set('autoUpdatesEnabled', safeSettings.autoUpdatesEnabled)
    mainStore.set('alertThreshold', safeSettings.alertThreshold)
    mainStore.set('smtpAllowSelfSigned', safeSettings.smtpAllowSelfSigned)
    mainStore.set('minimizeTray', safeSettings.minimizeTray)

    if (app.setLoginItemSettings) {
      app.setLoginItemSettings({
        openAtLogin: safeSettings.runAtStartup
      })
    }
    
    updateTrayMenu()
    return { success: true }
  })

  ipcMain.handle('send-test-alert', async (_, { webhookUrl, channelType }) => {
    // P16-7: Validate before any outbound request — primary SSRF guard
    const urlCheck = validateWebhookUrl(webhookUrl)
    if (!urlCheck.valid) {
      return { success: false, message: `Webhook URL rejected: ${urlCheck.reason}` }
    }
    try {
      let payload: any = {}
      const testMsg = `🧪 **[API Monitor Test Alert]** This is a simulated alert connection test.`

      if (channelType === 'discord') {
        payload = { content: testMsg }
      } else {
        payload = { text: testMsg }
      }

      await axios.post(webhookUrl, payload, { timeout: 5000 })
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('send-test-email', async () => {
    try {
      const smtpServer = mainStore.get('smtpServer', '')
      const smtpPort = mainStore.get('smtpPort', '587')
      const smtpUser = mainStore.get('smtpUser', '')
      const smtpPass = getDecryptedSmtpPass()
      const notifyEmail = mainStore.get('notifyEmail', '')

      if (!smtpServer || !notifyEmail) {
        throw new Error('SMTP Server and Recipient Email are required.')
      }

      const smtpAllowSelfSigned = mainStore.get('smtpAllowSelfSigned', false) === true
      const transporter = nodemailer.createTransport({
        host: smtpServer,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465,
        auth: (smtpUser && smtpPass) ? {
          user: smtpUser,
          pass: smtpPass
        } : undefined,
        tls: { rejectUnauthorized: !smtpAllowSelfSigned }
      })

      const emails = notifyEmail.split(',').map((e: string) => e.trim()).filter(Boolean)
      
      const info = await transporter.sendMail({
        from: `"Xerox API Monitor" <${smtpUser || 'noreply@xerox-monitor.local'}>`,
        to: emails.join(', '),
        subject: "🧪 Test Email - Xerox API Monitor",
        text: "This is a test email from your Xerox API Monitor ERP to verify your SMTP configuration.",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 16px; color: white;">
              <h2 style="margin: 0; font-size: 18px;">🧪 Xerox API Monitor - SMTP Test</h2>
            </div>
            <div style="padding: 24px; background-color: #f8fafc; color: #334155;">
              <p style="font-size: 16px; margin-top: 0;"><strong>Success!</strong></p>
              <p>Your SMTP configuration in the Xerox API Monitor is working correctly. You will now receive alert notifications at this address when an endpoint goes offline.</p>
              <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 24px 0;" />
              <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Sent automatically by your local Xerox API Monitor background service.</p>
            </div>
          </div>
        `
      })

      return { success: true, message: `Email sent: ${info.messageId}` }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })

  // System Tray Initialization
  if (tray) {
    try {
      tray.destroy()
    } catch {}
  }
  tray = new Tray(appIcon)
  
  const updateTrayMenu = () => {
    const maintenanceMode = mainStore.get('maintenanceMode', false)

    const endpoints = DatabaseService.getEndpoints()
    const offlineCount = endpoints.filter(e => e.status === 'error').length
    const totalCount = endpoints.length
    
    let currentStatus: 'idle' | 'offline' | 'warning' | 'online' = totalCount === 0 
      ? 'idle' 
      : offlineCount === totalCount 
      ? 'offline' 
      : offlineCount > 0 
      ? 'warning' 
      : 'online'
      
    let statusText = totalCount === 0
      ? 'Xerox API Monitor - No Endpoints Registered'
      : currentStatus === 'offline'
      ? `Xerox API Monitor - CRITICAL: All ${totalCount} Offline`
      : currentStatus === 'warning'
      ? `Xerox API Monitor - Warning: ${offlineCount} of ${totalCount} Offline`
      : 'Xerox API Monitor - All Systems Online'

    if (maintenanceMode) {
      currentStatus = 'idle'
      statusText = 'Xerox API Monitor - MAINTENANCE MODE (Paused)'
    }

    const newIcon = getIcon(currentStatus)
    tray?.setImage(newIcon)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(newIcon)
      if (process.platform === 'win32') {
        try {
          // Clear any overlay icon to avoid double circle duplication on the taskbar
          mainWindow.setOverlayIcon(null, '')
        } catch (err) {
          console.error('Failed to clear taskbar overlay icon:', err)
        }
      }
    }
      
    const contextMenu = Menu.buildFromTemplate([
      { label: statusText, enabled: false },
      { type: 'separator' },
      { label: 'Open Interface', click: () => {
          const windows = BrowserWindow.getAllWindows()
          if (windows.length > 0) {
            windows[0].show()
          } else {
            createWindow()
          }
        } 
      },
      { label: 'Check All Endpoints Now', click: () => {
          // P16-15: run all checks in parallel instead of sequentially
          const endpointsList = DatabaseService.getEndpoints()
          Promise.all(endpointsList.map(ep => MonitoringService.checkEndpoint(ep.id))).catch(console.error)
        }
      },
      { type: 'separator' },
      { label: 'Exit Monitor', click: () => {
          isQuitting = true
          app.quit()
        } 
      }
    ])
    
    tray?.setToolTip(statusText)
    tray?.setContextMenu(contextMenu)
  }
  
  updateTrayMenu()
  MonitoringService.onStateChange = () => {
    updateTrayMenu()
    // P16-14: push state-changed event to renderer so UI refreshes without polling
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('state-changed')
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
})
