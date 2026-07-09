import { useState } from 'react'
import { Upload } from 'lucide-react'

interface AuthConfiguratorProps {
  type: string
  value: any
  onChange: (data: { type: any; config: any }) => void
}

export function AuthConfigurator({ type, value, onChange }: AuthConfiguratorProps) {
  const [validationError, setValidationError] = useState<string>('')

  const handleConfigChange = (newConfig: any) => {
    onChange({ type, config: { ...value, ...newConfig } })
  }

  const renderConfigFields = () => {
    switch (type) {
      case 'apiKey':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">API Key Name</label>
              <input
                type="text"
                value={value.key || ''}
                onChange={(e) => handleConfigChange({ key: e.target.value })}
                placeholder="e.g., X-API-Key or Authorization"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">API Key Value</label>
              <input
                type="password"
                value={value.value || ''}
                onChange={(e) => handleConfigChange({ value: e.target.value })}
                placeholder="Enter API key token"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Location</label>
              <select
                value={value.location || 'header'}
                onChange={(e) => handleConfigChange({ location: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              >
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
              </select>
            </div>
          </div>
        )

      case 'ntlm':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Domain</label>
              <input
                type="text"
                value={value.domain || ''}
                onChange={(e) => handleConfigChange({ domain: e.target.value })}
                placeholder="e.g., COMPANY.local"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">Your Windows AD Domain.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Username</label>
              <input
                type="text"
                value={value.username || ''}
                onChange={(e) => handleConfigChange({ username: e.target.value })}
                placeholder="Username (without domain)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Password</label>
              <input
                type="password"
                value={value.password || ''}
                onChange={(e) => handleConfigChange({ password: e.target.value })}
                placeholder="Windows password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        )

      case 'certificate':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Certificate File (.pfx/.p12)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pfx,.p12"
                  id="cert-upload-input"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const path = (file as any).path || file.name
                      // Run the native cert validation via IPC; fall back to true in browser
                      const isValid = window.electronAPI ? await window.electronAPI.validateCertificate(path, value.passphrase) : true
                      if (isValid) {
                        handleConfigChange({ certPath: path })
                        setValidationError('')
                      } else {
                        setValidationError('Invalid certificate file or passphrase')
                      }
                    }
                  }}
                />
                <label
                  htmlFor="cert-upload-input"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-800 border border-slate-700 rounded-xl cursor-pointer text-xs font-semibold transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Upload PFX File
                </label>
                {value.certPath && (
                  <span className="text-xs text-green-400 font-semibold truncate max-w-[200px]">
                    ✓ {value.certPath.split(/[/\\]/).pop()}
                  </span>
                )}
              </div>
              {validationError && <p className="text-rose-500 text-[10px] mt-1">{validationError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Passphrase (optional)</label>
              <input
                type="password"
                value={value.passphrase || ''}
                onChange={(e) => handleConfigChange({ passphrase: e.target.value })}
                placeholder="Certificate passphrase"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reject-unauth"
                checked={value.rejectUnauthorized ?? true}
                onChange={(e) => handleConfigChange({ rejectUnauthorized: e.target.checked })}
                className="rounded border-slate-800 text-blue-600 focus:ring-0"
              />
              <label htmlFor="reject-unauth" className="text-xs text-slate-300">
                Reject unauthorized certificates (disable for self-signed development servers)
              </label>
            </div>
          </div>
        )

      case 'oauth2':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Token URL</label>
              <input
                type="text"
                value={value.tokenUrl || ''}
                onChange={(e) => handleConfigChange({ tokenUrl: e.target.value })}
                placeholder="https://auth.company.com/oauth2/token"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Client ID</label>
                <input
                  type="text"
                  value={value.clientId || ''}
                  onChange={(e) => handleConfigChange({ clientId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Client Secret</label>
                <input
                  type="password"
                  value={value.clientSecret || ''}
                  onChange={(e) => handleConfigChange({ clientSecret: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Scope (optional)</label>
              <input
                type="text"
                value={value.scope || ''}
                onChange={(e) => handleConfigChange({ scope: e.target.value })}
                placeholder="e.g., api.read write"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        )

      case 'basic':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Username</label>
                <input
                  type="text"
                  value={value.username || ''}
                  onChange={(e) => handleConfigChange({ username: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={value.password || ''}
                  onChange={(e) => handleConfigChange({ password: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        )

      case 'cookie':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Login URL</label>
              <input
                type="text"
                value={value.loginUrl || ''}
                onChange={(e) => handleConfigChange({ loginUrl: e.target.value })}
                placeholder="https://erp.company.com/api/login"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Login Credentials Payload (JSON)</label>
              <textarea
                value={typeof value.credentials === 'string' ? value.credentials : JSON.stringify(value.credentials || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    handleConfigChange({ credentials: parsed })
                  } catch {
                    handleConfigChange({ credentials: e.target.value })
                  }
                }}
                placeholder='{ "username": "admin", "password": "secure" }'
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Expected Cookie Name</label>
              <input
                type="text"
                value={value.cookieName || ''}
                onChange={(e) => handleConfigChange({ cookieName: e.target.value })}
                placeholder="e.g., connect.sid or session_id"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        )

      default:
        return <p className="text-xs text-slate-400">No authentication configuration required.</p>
    }
  }

  return (
    <div className="border border-slate-800 rounded-2xl p-5 bg-slate-900/20 space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
          Authentication Method
        </label>
        <select
          value={type}
          onChange={(e) => onChange({ type: e.target.value, config: {} })}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          <option value="none">None (Public Endpoint)</option>
          <option value="apiKey">API Key Header/Query</option>
          <option value="ntlm">Windows Domain (NTLM)</option>
          <option value="certificate">Client Certificate (mTLS)</option>
          <option value="oauth2">OAuth2 Client Credentials</option>
          <option value="basic">Basic Credentials</option>
          <option value="cookie">Session Cookie Authentication</option>
        </select>
      </div>

      {type !== 'none' && (
        <div className="pt-3 border-t border-slate-800/60">
          {renderConfigFields()}
        </div>
      )}
    </div>
  )
}
export default AuthConfigurator
