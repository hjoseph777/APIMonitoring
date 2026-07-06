import React, { useState } from 'react'
import { Mail, Send, RotateCw, AlertTriangle, CheckCircle, FileText, Plus, X } from 'lucide-react'
import { useToast } from '../context/ToastContext'

interface EmailSimulation {
  id: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  timestamp: string
  status: 'sent' | 'failed'
}

export function EmailNotificationSimulator() {
  const [to, setTo] = useState('sysadmin@company.com')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('[ALERT] ERP Endpoint API_Sales is OFFLINE')
  const [body, setBody] = useState(
    'Warning: The ERP Endpoint API_Sales (http://localhost:8080/api/sales) has met the failure threshold. It has failed 10 consecutive checks over the last 10 minutes.\n\nError Code: ECONNREFUSED'
  )
  
  const [showCC, setShowCC] = useState(false)
  const [showBCC, setShowBCC] = useState(false)
  const [sending, setSending] = useState(false)
  const { addToast } = useToast()
  
  const [history, setHistory] = useState<EmailSimulation[]>([
    {
      id: '1',
      to: 'sysadmin@company.com',
      subject: '[ALERT] ERP Endpoint ERP_Billing is OFFLINE',
      body: 'Warning: The ERP Endpoint ERP_Billing has failed 10 consecutive checks.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'sent'
    },
    {
      id: '2',
      to: 'sysadmin@company.com',
      subject: '[ALERT] ERP Endpoint CRM_Sync failed auth',
      body: 'Warning: CRM_Sync endpoint rejected token.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: 'failed'
    }
  ])

  const handleSendSimulation = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    
    // Simulate SMTP network call
    setTimeout(() => {
      const isSent = Math.random() > 0.15
      const newEmail: EmailSimulation = {
        id: Date.now().toString(),
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body,
        timestamp: new Date().toISOString(),
        status: isSent ? 'sent' : 'failed'
      }
      setHistory((prev) => [newEmail, ...prev])
      setSending(false)
      
      if (isSent) {
        addToast('Simulated email warning sent successfully!', 'success')
      } else {
        addToast('Simulated SMTP relay error. Failed to send email.', 'error')
      }
    }, 1200)
  }

  const handleRetry = (email: EmailSimulation) => {
    setSending(true)
    setTimeout(() => {
      setHistory((prev) =>
        prev.map((item) =>
          item.id === email.id ? { ...item, status: 'sent', timestamp: new Date().toISOString() } : item
        )
      )
      setSending(false)
      addToast('Simulated email warning re-sent successfully!', 'success')
    }, 1000)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Simulation Composer */}
      <form onSubmit={handleSendSimulation} className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-850 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
          <Mail className="w-5 h-5 text-blue-500" />
          <h2 className="text-md font-bold text-white uppercase tracking-wider">Email Notification Simulator</h2>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            {!showCC && (
              <button
                type="button"
                onClick={() => setShowCC(true)}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                + Add CC
              </button>
            )}
            {!showBCC && (
              <button
                type="button"
                onClick={() => setShowBCC(true)}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                + Add BCC
              </button>
            )}
          </div>

          {showCC && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-slate-400 font-semibold mb-1">CC</label>
                <input
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button type="button" onClick={() => { setShowCC(false); setCc(''); }} className="mt-5 text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {showBCC && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-slate-400 font-semibold mb-1">BCC</label>
                <input
                  type="email"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button type="button" onClick={() => { setShowBCC(false); setBcc(''); }} className="mt-5 text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">HTML/Text Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-850">
          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/15"
          >
            {sending ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Simulate Email Alert
          </button>
        </div>
      </form>

      {/* History Log Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-4 h-fit">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
          <FileText className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Simulated SMTP Logs</h3>
        </div>

        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
          {history.map((email) => (
            <div key={email.id} className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[9px]">
                  {new Date(email.timestamp).toLocaleTimeString()}
                </span>
                <span className={`flex items-center gap-1 font-semibold ${
                  email.status === 'sent' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {email.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {email.status === 'sent' ? 'Sent' : 'Failed'}
                </span>
              </div>
              <div className="space-y-0.5">
                <p className="text-white font-semibold truncate">To: {email.to}</p>
                <p className="text-slate-400 truncate">Sub: {email.subject}</p>
              </div>
              
              {email.status === 'failed' && (
                <button
                  onClick={() => handleRetry(email)}
                  disabled={sending}
                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-all mt-1"
                >
                  <RotateCw className="w-3 h-3" /> Retry SMTP Relay
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
export default EmailNotificationSimulator
