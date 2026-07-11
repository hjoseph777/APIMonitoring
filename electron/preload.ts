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
  copyToClipboard: (text: string, endpointName?: string) => ipcRenderer.invoke('copy-to-clipboard', { text, endpointName }),
  validateCertificate: (path: string, passphrase?: string) => ipcRenderer.invoke('validate-certificate', { path, passphrase }),
  testAuthentication: (endpointId: string) => ipcRenderer.invoke('test-authentication', { endpointId }),
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
  // P16-14: IPC push so renderer refreshes on state change instead of polling
  onStateChanged: (callback: () => void) => ipcRenderer.on('state-changed', (_event) => callback()),
  offStateChanged: () => ipcRenderer.removeAllListeners('state-changed'),

  // Self-monitoring footprint widget
  getFootprint: () => ipcRenderer.invoke('get-footprint'),
  onFootprintUpdate: (callback: (snapshot: FootprintSnapshot) => void) =>
    ipcRenderer.on('footprint-update', (_event, snapshot) => callback(snapshot)),
  offFootprintUpdate: () => ipcRenderer.removeAllListeners('footprint-update')
})
export {}
