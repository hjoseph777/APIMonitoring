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
