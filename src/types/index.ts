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
  authStatus?: 'valid' | 'expired' | 'failed' | 'none';
  responseTimeHistory?: number[]; // history of last response times in ms
  timeout?: number; // in seconds
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
  type: 'info' | 'error' | 'xerox';
  success?: boolean; // specifically for xerox copy events
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
      clearLogs: () => Promise<{ success: boolean }>;
      copyToClipboard: (text: string, endpointName?: string) => Promise<{ success: boolean }>;
      validateCertificate: (path: string, passphrase?: string) => Promise<boolean>;
      testAuthentication: (endpointId: string) => Promise<{ status: number }>;
      testConnection: (endpoint: Partial<Endpoint>) => Promise<{ success: boolean; status?: number; message?: string }>;
      exportBackup: () => Promise<string>;
      importBackup: (jsonString: string) => Promise<{ success: boolean }>;
      resetAllData: () => Promise<{ success: boolean }>;
      getSettings: () => Promise<{ nativeNotify: boolean; smtpServer: string; notifyEmail: string; globalWebhook: string; globalWebhookChannel: string }>;
      saveSettings: (settings: { nativeNotify: boolean; smtpServer: string; notifyEmail: string; globalWebhook: string; globalWebhookChannel: string }) => Promise<{ success: boolean }>;
      sendTestAlert: (args: { webhookUrl: string; channelType: string }) => Promise<{ success: boolean; message?: string }>;
    }
  }
}
