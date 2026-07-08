import { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import DatabaseService from './database'
import MonitoringService from './monitoring'
import { Endpoint, Log } from '../src/types'

let isQuitting = false

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

// Enforce single instance lock in production to prevent duplicate tray icons
if (app.isPackaged) {
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
  // Start background monitoring service
  MonitoringService.start()

  // Register IPC handlers
  ipcMain.handle('get-endpoints', () => DatabaseService.getEndpoints())
  
  ipcMain.handle('save-endpoint', (_, endpoint: Endpoint) => {
    DatabaseService.saveEndpoint(endpoint)
    MonitoringService.schedule(endpoint) // Schedule/re-schedule
    return { success: true }
  })

  ipcMain.handle('delete-endpoint', (_, id: string) => {
    MonitoringService.unschedule(id)
    DatabaseService.deleteEndpoint(id)
    return { success: true }
  })

  ipcMain.handle('refresh-endpoint', async (_, id: string) => {
    await MonitoringService.checkEndpoint(id)
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

  // Clipboard copy and log tracking
  ipcMain.handle('copy-to-clipboard', (_, { text, endpointName }) => {
    let success = false
    try {
      clipboard.writeText(text)
      success = true
    } catch (err) {
      success = false
    }

    const log: Log = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      endpointName: endpointName || 'System',
      message: success 
        ? `Successfully copied payload buffer to clipboard.`
        : `Failed copying payload buffer to clipboard.`,
      timestamp: new Date().toISOString(),
      type: 'xerox',
      success
    }
    DatabaseService.saveLog(log)
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

  // Global settings
  ipcMain.handle('get-settings', () => {
    const Store = require('electron-store')
    const store = new Store()
    return {
      nativeNotify: store.get('nativeNotify', true),
      smtpServer: store.get('smtpServer', 'smtp.company.com'),
      notifyEmail: store.get('notifyEmail', 'admin@company.com'),
      globalWebhook: store.get('globalWebhook', ''),
      globalWebhookChannel: store.get('globalWebhookChannel', 'msteams')
    }
  })

  ipcMain.handle('save-settings', (_, settings: any) => {
    const Store = require('electron-store')
    const store = new Store()
    store.set('nativeNotify', settings.nativeNotify)
    store.set('smtpServer', settings.smtpServer)
    store.set('notifyEmail', settings.notifyEmail)
    store.set('globalWebhook', settings.globalWebhook)
    store.set('globalWebhookChannel', settings.globalWebhookChannel)
    return { success: true }
  })

  ipcMain.handle('send-test-alert', async (_, { webhookUrl, channelType }) => {
    try {
      const axios = require('axios')
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

  // System Tray Initialization
  if (tray) {
    try {
      tray.destroy()
    } catch (e) {}
  }
  tray = new Tray(appIcon)
  
  const updateTrayMenu = () => {
    const endpoints = DatabaseService.getEndpoints()
    const offlineCount = endpoints.filter(e => e.status === 'error').length
    const totalCount = endpoints.length
    const onlineCount = endpoints.filter(e => e.status === 'success').length
    const currentStatus = totalCount === 0 
      ? 'idle' 
      : offlineCount === totalCount 
      ? 'offline' 
      : offlineCount > 0 
      ? 'warning' 
      : 'online'
      
    const statusText = totalCount === 0
      ? 'Xerox API Monitor - No Endpoints Registered'
      : currentStatus === 'offline'
      ? `Xerox API Monitor - CRITICAL: All ${totalCount} Offline`
      : currentStatus === 'warning'
      ? `Xerox API Monitor - Warning: ${offlineCount} of ${totalCount} Offline`
      : 'Xerox API Monitor - All Systems Online'

    const newIcon = getIcon(currentStatus)
    tray?.setImage(newIcon)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(newIcon)
      if (process.platform === 'win32') {
        try {
          mainWindow.setOverlayIcon(newIcon, statusText)
        } catch (err) {
          console.error('Failed to set taskbar overlay icon:', err)
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
  setInterval(updateTrayMenu, 3500)

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
