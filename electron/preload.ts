import { contextBridge, ipcRenderer } from 'electron'
import { Endpoint, FootprintSnapshot } from '../src/types'

// Expose safe, protected APIs to the React renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Endpoints CRUD
  getEndpoints: () => ipcRenderer.invoke('get-endpoints'),
  saveEndpoint: (endpoint: Endpoint) => ipcRenderer.invoke('save-endpoint', endpoint),
  deleteEndpoint: (id: string) => ipcRenderer.invoke('delete-endpoint', id),
  refreshEndpoint: (id: string) => ipcRenderer.invoke('refresh-endpoint', id),

  // Alerts API
  getAlerts: () => ipcRenderer.invoke('get-alerts'),
  clearAllAlerts: () => ipcRenderer.invoke('clear-all-alerts'),
  deleteAlert: (id: string) => ipcRenderer.invoke('delete-alert', id),
  markAlertAsRead: (id: string) => ipcRenderer.invoke('mark-alert-as-read', id),
  archiveAlerts: () => ipcRenderer.invoke('archive-alerts'),

  // Logs API
  getLogs: () => ipcRenderer.invoke('get-logs'),
  exportLogsCsv: () => ipcRenderer.invoke('export-logs-csv'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),

  // Utility Operations
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', { text }),
  validateCertificate: (path: string, passphrase?: string) => ipcRenderer.invoke('validate-certificate', { path, passphrase }),
  testConnection: (endpoint: Partial<Endpoint>) => ipcRenderer.invoke('test-connection', endpoint),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: (jsonString: string) => ipcRenderer.invoke('import-backup', jsonString),
  resetAllData: () => ipcRenderer.invoke('reset-all-data'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  sendTestAlert: (args: { webhookUrl: string; channelType: string }) => ipcRenderer.invoke('send-test-alert', args),
  sendTestEmail: () => ipcRenderer.invoke('send-test-email'),
  seedDemoData: (mode: 'green' | 'mixed' | 'lockout') => ipcRenderer.invoke('seed-demo-data', mode),
  clearDemoData: () => ipcRenderer.invoke('clear-demo-data'),
  // P16-14: IPC push so renderer refreshes on state change instead of polling.
  // onStateChanged returns the actual registered listener so offStateChanged can
  // remove exactly that one — removeAllListeners would also drop any other
  // subscriber on the same channel, not just this caller's.
  onStateChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('state-changed', listener)
    return listener
  },
  offStateChanged: (listener: (...args: unknown[]) => void) => ipcRenderer.removeListener('state-changed', listener),

  // Self-monitoring footprint widget — same scoped-removal pattern as above.
  getFootprint: () => ipcRenderer.invoke('get-footprint'),
  onFootprintUpdate: (callback: (snapshot: FootprintSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: FootprintSnapshot) => callback(snapshot)
    ipcRenderer.on('footprint-update', listener)
    return listener
  },
  offFootprintUpdate: (listener: (...args: unknown[]) => void) => ipcRenderer.removeListener('footprint-update', listener),

  getAppVersion: () => ipcRenderer.invoke('get-app-version')
})
export {}
