// Pure settings validation/coercion logic — no Electron imports, so this can be
// unit tested directly without a running Electron process.

export type WebhookChannel = 'msteams' | 'discord' | 'slack'

export interface AppSettings {
  nativeNotify: boolean
  smtpServer: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  notifyEmail: string
  globalWebhook: string
  globalWebhookChannel: WebhookChannel
  runAtStartup: boolean
  maintenanceMode: boolean
  autoExportLogs: boolean
  exportPath: string
  autoUpdatesEnabled: boolean
  alertThreshold: number
  smtpAllowSelfSigned: boolean
  minimizeTray: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  nativeNotify: true,
  smtpServer: 'smtp.company.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  notifyEmail: 'admin@company.com',
  globalWebhook: '',
  globalWebhookChannel: 'msteams',
  runAtStartup: false,
  maintenanceMode: false,
  autoExportLogs: false,
  exportPath: '',
  autoUpdatesEnabled: false,
  alertThreshold: 2,
  smtpAllowSelfSigned: false,
  minimizeTray: true
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function asPortString(value: unknown, fallback: string): string {
  const parsed = parseInt(String(value), 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) return fallback
  return String(parsed)
}

export function asThreshold(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(20, Math.max(1, parsed))
}

export function asWebhookChannel(value: unknown, fallback: WebhookChannel): WebhookChannel {
  return value === 'discord' || value === 'slack' || value === 'msteams' ? value : fallback
}

export function parseAndValidateSettings(input: unknown): { ok: true; value: AppSettings } | { ok: false; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Invalid settings payload' }
  }

  const source = input as Record<string, unknown>
  const parsed: AppSettings = {
    nativeNotify: asBool(source.nativeNotify, DEFAULT_SETTINGS.nativeNotify),
    smtpServer: asString(source.smtpServer, DEFAULT_SETTINGS.smtpServer).trim(),
    smtpPort: asPortString(source.smtpPort, DEFAULT_SETTINGS.smtpPort),
    smtpUser: asString(source.smtpUser, DEFAULT_SETTINGS.smtpUser).trim(),
    smtpPass: asString(source.smtpPass, DEFAULT_SETTINGS.smtpPass),
    notifyEmail: asString(source.notifyEmail, DEFAULT_SETTINGS.notifyEmail).trim(),
    globalWebhook: asString(source.globalWebhook, DEFAULT_SETTINGS.globalWebhook).trim(),
    globalWebhookChannel: asWebhookChannel(source.globalWebhookChannel, DEFAULT_SETTINGS.globalWebhookChannel),
    runAtStartup: asBool(source.runAtStartup, DEFAULT_SETTINGS.runAtStartup),
    maintenanceMode: asBool(source.maintenanceMode, DEFAULT_SETTINGS.maintenanceMode),
    autoExportLogs: asBool(source.autoExportLogs, DEFAULT_SETTINGS.autoExportLogs),
    exportPath: asString(source.exportPath, DEFAULT_SETTINGS.exportPath).trim(),
    autoUpdatesEnabled: asBool(source.autoUpdatesEnabled, DEFAULT_SETTINGS.autoUpdatesEnabled),
    alertThreshold: asThreshold(source.alertThreshold, DEFAULT_SETTINGS.alertThreshold),
    smtpAllowSelfSigned: asBool(source.smtpAllowSelfSigned, DEFAULT_SETTINGS.smtpAllowSelfSigned),
    minimizeTray: asBool(source.minimizeTray, DEFAULT_SETTINGS.minimizeTray)
  }

  if (parsed.notifyEmail.length > 0) {
    const recipients = parsed.notifyEmail.split(',').map(e => e.trim()).filter(Boolean)
    const invalid = recipients.find(e => !e.includes('@') || e.startsWith('@') || e.endsWith('@'))
    if (invalid) {
      return { ok: false, message: `Invalid recipient email: ${invalid}` }
    }
  }

  return { ok: true, value: parsed }
}
