import React, { useState, useEffect } from 'react'
import { Bell, ShieldCheck, ShieldAlert, Terminal, Monitor, Cpu, Sun, Moon, BarChart3, Settings, Database, CheckCircle2 } from 'lucide-react'
import { useMonitoringStore } from '../store/monitoringStore'
import { Pill } from './ui/Pill'

interface LayoutProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
  alertCount: number
  systemStatus: 'online' | 'warning' | 'offline'
  lastSync?: string
  tlsSummary: { total: number; selfSigned: number }
}

export function Layout({ children, activeTab, setActiveTab, alertCount, systemStatus, lastSync, tlsSummary }: LayoutProps) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved !== 'light' // Default to dark mode
  })
  const [bellOpen, setBellOpen] = useState(false)

  const alerts = useMonitoringStore(state => state.alerts)
  const markAlertAsRead = useMonitoringStore(state => state.markAlertAsRead)
  const unreadAlerts = alerts.filter(a => !a.read).slice(0, 5)

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Load saved theme on mount/change
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const getStatusColor = () => {
    switch (systemStatus) {
      case 'online':
        return 'bg-green-500 shadow-green-500/50'
      case 'warning':
        return 'bg-yellow-500 shadow-yellow-500/50'
      case 'offline':
        return 'bg-red-500 shadow-red-500/50'
      default:
        return 'bg-slate-500'
    }
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Monitor },
    { id: 'settings', label: 'Endpoint Registry', icon: Settings },
    { id: 'notification-json', label: 'Notification & JSON', icon: Database },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ]

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-slate-800 dark:text-slate-100 transition-colors duration-305 select-none">

      {/* Static Left Sidebar */}
      <aside className="w-56 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col justify-between shrink-0 transition-colors duration-300">
        <div className="flex flex-col">
          {/* Logo Brand Area */}
          <div className="p-4 flex items-center gap-2 border-b border-[var(--border-color)]">
            <div className="w-5.5 h-5.5 bg-[#e51937] rounded-[5px] flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <g transform="rotate(45 12 12)">
                  <path d="M12 2 Q12 12 2 12 Q12 12 12 22 Q12 12 22 12 Q12 12 12 2 Z" />
                </g>
              </svg>
            </div>
            <div className="flex items-baseline">
              <span className="font-extrabold text-sm tracking-tighter text-[#e51937] lowercase">xerox</span>
              <span className="text-xs text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider ml-1">Monitor</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5 flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer/Version Info in Sidebar */}
        <div className="p-4 border-t border-[var(--border-color)] flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300 font-semibold uppercase tracking-wider">
          <Cpu className="w-3.5 h-3.5" />
          <span>v1.0.0 (GUI v2.0)</span>
        </div>
      </aside>

      {/* Right-Side Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Header Bar */}
        <header className="h-14 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-md px-6 flex items-center justify-between transition-colors duration-300">

          {/* Status Indicators */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Terminal className="w-3.5 h-3.5 text-blue-500" />
              Status:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-primary)] rounded-lg shrink-0">
              <span className={`h-2 w-2 rounded-full ${getStatusColor()}`}></span>
              <span className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-350">
                {systemStatus === 'online' ? 'All Systems Online' : `${systemStatus === 'warning' ? 'Minor Issues' : 'Critical Outages'}`}
              </span>
            </div>

            {lastSync && (
              <span className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                &middot; Last sync {lastSync}
              </span>
            )}

            {tlsSummary.total > 0 && (
              <Pill tone={tlsSummary.selfSigned === 0 ? 'ok' : 'warn'} className="hidden sm:inline-flex">
                {tlsSummary.selfSigned === 0 ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                {tlsSummary.selfSigned === 0
                  ? 'TLS Verified'
                  : `${tlsSummary.selfSigned} of ${tlsSummary.total} allow self-signed`}
              </Pill>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl transition-all duration-200 cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setBellOpen(prev => !prev)}
                className="relative p-2 text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl transition-all duration-200 cursor-pointer"
                title="Alerts"
              >
                <Bell className="w-3.5 h-3.5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-bounce">
                    {alertCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 top-11 w-72 z-50 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 border-b border-[var(--border-color)] text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {unreadAlerts.length > 0 ? `${unreadAlerts.length} unread alert${unreadAlerts.length > 1 ? 's' : ''}` : 'Alerts'}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {unreadAlerts.length === 0 ? (
                        <div className="px-3.5 py-6 flex flex-col items-center gap-1.5 text-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">No new alerts</span>
                        </div>
                      ) : (
                        unreadAlerts.map(alert => (
                          <button
                            key={alert.id}
                            onClick={() => markAlertAsRead(alert.id)}
                            className="w-full text-left px-3.5 py-2.5 border-b border-[var(--border-color)] last:border-b-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                            title="Click to mark as read"
                          >
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{alert.endpointName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{alert.message}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto w-full max-w-5xl mx-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="h-8 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Xerox API Engine Running</span>
          <span className="font-mono uppercase tracking-wider text-xs">Auto-polling active</span>
        </footer>

      </div>
    </div>
  )
}
export default Layout
