export interface Endpoint {
  id: string;
  name: string;
  url: string;
  interval: number; // in minutes
  status: 'idle' | 'success' | 'error';
  lastCheck?: string; // ISO timestamp
  errorCount: number;
  consecutiveErrors: number;
  authType: 'none' | 'apiKey' | 'ntlm' | 'certificate' | 'oauth2' | 'basic' | 'cookie';
  authConfig: AuthConfig;
  responseTimeHistory?: number[]; // history of last response times in ms
  timeout?: number; // in seconds
  allowSelfSigned?: boolean; // allow self-signed / internal TLS certificates (default: false)
  monitoringPaused?: boolean; // true while AD Lockout Protection has halted this endpoint's recurring checks
}

export type AuthConfig = 
  | { type: 'none' }
  | { type: 'apiKey'; key: string; value: string; location: 'header' | 'query' }
  | { type: 'ntlm'; username: string; password: string; domain: string; workstation?: string }
  | { type: 'certificate'; certPath: string; passphrase?: string; rejectUnauthorized?: boolean }
  | { type: 'oauth2'; clientId: string; clientSecret: string; tokenUrl: string; scope?: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'cookie'; loginUrl: string; credentials: any; cookieName: string };

export interface Alert {
  id: string;
  endpointId: string;
  endpointName: string;
  message: string;
  timestamp: string; // ISO timestamp
  read: boolean;
}

export interface Log {
  id: string;
  endpointId?: string;
  endpointName?: string;
  message: string;
  timestamp: string; // ISO timestamp
  type: 'info' | 'error' | 'clipboard';
  success?: boolean; // specifically for clipboard copy events
}

declare global {
  interface Window {
    electronAPI: {
      getEndpoints: () => Promise<Endpoint[]>;
      saveEndpoint: (endpoint: Endpoint) => Promise<{ success: boolean }>;
      deleteEndpoint: (id: string) => Promise<{ success: boolean }>;
      refreshEndpoint: (id: string) => Promise<{ success: boolean }>;
      getAlerts: () => Promise<Alert[]>;
      clearAllAlerts: () => Promise<{ success: boolean }>;
      deleteAlert: (id: string) => Promise<{ success: boolean }>;
      markAlertAsRead: (id: string) => Promise<{ success: boolean }>;
      archiveAlerts: () => Promise<{ success: boolean }>;
      getLogs: () => Promise<Log[]>;
      exportLogsCsv: () => Promise<string>;
      clearLogs: () => Promise<{ success: boolean }>;
      copyToClipboard: (text: string, endpointName?: string) => Promise<{ success: boolean }>;
      validateCertificate: (path: string, passphrase?: string) => Promise<boolean>;
      testAuthentication: (endpointId: string) => Promise<{ status: number }>;
      testConnection: (endpoint: Partial<Endpoint>) => Promise<{ success: boolean; status?: number; message?: string }>;
      exportBackup: () => Promise<string>;
      importBackup: (jsonString: string) => Promise<{ success: boolean }>;
      resetAllData: () => Promise<{ success: boolean }>;
      getSettings: () => Promise<{ nativeNotify: boolean; smtpServer: string; smtpPort: string; smtpUser: string; smtpPass: string; notifyEmail: string; globalWebhook: string; globalWebhookChannel: string; runAtStartup: boolean; maintenanceMode: boolean; autoExportLogs: boolean; exportPath: string; autoUpdatesEnabled: boolean; alertThreshold: number; smtpAllowSelfSigned: boolean; minimizeTray: boolean }>;
      saveSettings: (settings: { nativeNotify: boolean; smtpServer: string; smtpPort: string; smtpUser: string; smtpPass: string; notifyEmail: string; globalWebhook: string; globalWebhookChannel: string; runAtStartup: boolean; maintenanceMode: boolean; autoExportLogs: boolean; exportPath: string; autoUpdatesEnabled: boolean; alertThreshold: number; smtpAllowSelfSigned: boolean; minimizeTray: boolean }) => Promise<{ success: boolean }>;
      sendTestAlert: (args: { webhookUrl: string; channelType: string }) => Promise<{ success: boolean; message?: string }>;
      sendTestEmail: () => Promise<{ success: boolean; message?: string }>;
      seedDemoData: (mode: 'green' | 'mixed' | 'lockout') => Promise<{ success: boolean; message?: string }>;
      clearDemoData: () => Promise<{ success: boolean; message?: string }>;
      onStateChanged: (callback: () => void) => void;
      offStateChanged: () => void;
    }
  }
}
