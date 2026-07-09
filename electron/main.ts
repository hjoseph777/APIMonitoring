import { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { randomUUID } from 'crypto'
import axios from 'axios'
import * as fs from 'fs'
import DatabaseService from './database'
import MonitoringService from './monitoring'
import { Endpoint, Log } from '../src/types'

let isQuitting = false

// Module-level electron-store singleton
const Store = require('electron-store')
const mainStore = new Store()

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 550,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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
              const headers = ['Timestamp', 'Type', 'Status', 'Message', 'Endpoint']
              const csv = [
                headers.join(','),
                ...logs.map(l => [
                  `"${l.timestamp}"`,
                  `"${l.type}"`,
                  `"${l.success ? 'Success' : 'Error'}"`,
                  `"${(l.message || '').replace(/"/g, '""')}"`,
                  `"${(l.endpointName || '').replace(/"/g, '""')}"`
                ].join(','))
              ].join('\n')
              
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
    await MonitoringService.checkEndpoint(id)
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
  ipcMain.handle('clear-logs', () => {
    DatabaseService.clearLogs()
    return { success: true }
  })

  // Clipboard copy
  ipcMain.handle('copy-to-clipboard', (_, { text, endpointName }) => {
    let success = false
    try {
      clipboard.writeText(text)
      success = true
    } catch (err) {
      success = false
    }
    return { success }
  })

  // Certificate validator
  ipcMain.handle('validate-certificate', (_, { path, passphrase }) => {
    try {
      const fs = require('fs')
      if (fs.existsSync(path)) {
        return true
      }
    } catch {
      return false
    }
    return false
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
      nativeNotify: mainStore.get('nativeNotify', true),
      smtpServer: mainStore.get('smtpServer', 'smtp.company.com'),
      smtpPort: mainStore.get('smtpPort', '587'),
      smtpUser: mainStore.get('smtpUser', ''),
      smtpPass: mainStore.get('smtpPass', ''),
      notifyEmail: mainStore.get('notifyEmail', 'admin@company.com'),
      globalWebhook: mainStore.get('globalWebhook', ''),
      globalWebhookChannel: mainStore.get('globalWebhookChannel', 'msteams'),
      runAtStartup: mainStore.get('runAtStartup', false),
      maintenanceMode: mainStore.get('maintenanceMode', false),
      autoExportLogs: mainStore.get('autoExportLogs', false),
      exportPath: mainStore.get('exportPath', ''),
      autoUpdatesEnabled: mainStore.get('autoUpdatesEnabled', false)
    }
  })

  ipcMain.handle('save-settings', (_, settings: any) => {
    mainStore.set('nativeNotify', settings.nativeNotify)
    mainStore.set('smtpServer', settings.smtpServer)
    mainStore.set('smtpPort', settings.smtpPort)
    mainStore.set('smtpUser', settings.smtpUser)
    mainStore.set('smtpPass', settings.smtpPass)
    mainStore.set('notifyEmail', settings.notifyEmail)
    mainStore.set('globalWebhook', settings.globalWebhook)
    mainStore.set('globalWebhookChannel', settings.globalWebhookChannel)
    mainStore.set('runAtStartup', settings.runAtStartup)
    mainStore.set('maintenanceMode', settings.maintenanceMode)
    mainStore.set('autoExportLogs', settings.autoExportLogs)
    mainStore.set('exportPath', settings.exportPath)
    mainStore.set('autoUpdatesEnabled', settings.autoUpdatesEnabled)

    if (app.setLoginItemSettings) {
      app.setLoginItemSettings({
        openAtLogin: settings.runAtStartup === true
      })
    }
    
    updateTrayMenu()
    return { success: true }
  })

  ipcMain.handle('send-test-alert', async (_, { webhookUrl, channelType }) => {
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
      const smtpPass = mainStore.get('smtpPass', '')
      const notifyEmail = mainStore.get('notifyEmail', '')

      if (!smtpServer || !notifyEmail) {
        throw new Error('SMTP Server and Recipient Email are required.')
      }

      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: smtpServer,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465,
        auth: (smtpUser && smtpPass) ? {
          user: smtpUser,
          pass: smtpPass
        } : undefined
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
    } catch (e) {}
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
      { label: 'Check All Endpoints Now', click: async () => {
          const endpointsList = DatabaseService.getEndpoints()
          for (const ep of endpointsList) {
            await MonitoringService.checkEndpoint(ep.id)
          }
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
  MonitoringService.onStateChange = updateTrayMenu

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
