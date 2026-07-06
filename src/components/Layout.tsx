import React, { useState, useEffect } from 'react'
import { Bell, ShieldCheck, Terminal, AlertTriangle, Monitor, Cpu, Sun, Moon, BarChart3, Settings } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
  alertCount: number
  systemStatus: 'online' | 'warning' | 'offline'
}

export function Layout({ children, activeTab, setActiveTab, alertCount, systemStatus }: LayoutProps) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved !== 'light' // Default to dark mode
  })

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
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-300 select-none">
      {/* Horizontal Top Header (incorporating Nav tabs) */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 dark:bg-slate-900/85 dark:border-slate-800/80 backdrop-blur-md px-4 py-2 flex items-center justify-between transition-colors duration-300">
        
        {/* Left Brand Area */}
        <div className="flex items-center gap-2">
          {/* Exact Xerox Rounded Box Logo */}
          <div className="w-5 h-5 bg-[#e51937] rounded-[5px] flex items-center justify-center shadow-sm shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(45 12 12)">
                <path d="M12 2 Q12 12 2 12 Q12 12 12 22 Q12 12 22 12 Q12 12 12 2 Z" />
              </g>
            </svg>
          </div>
          <div className="flex items-baseline">
            <span className="font-extrabold text-sm tracking-tighter text-[#e51937] lowercase">xerox</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider ml-1">Monitor</span>
          </div>
        </div>

        {/* Center Navigation Tabs (Horizontal) */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right Status Actions Area */}
        <div className="flex items-center gap-1.5">
          {/* Status Dot */}
          <div className="flex items-center gap-1 mr-1">
            <span className={`h-2 w-2 rounded-full shadow-sm animate-pulse-fast ${getStatusColor()}`}></span>
          </div>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/50 rounded-lg transition-all duration-200"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Notification Bell */}
          <button className="relative p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/50 rounded-lg transition-all duration-200">
            <Bell className="w-3.5 h-3.5" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-bounce">
                {alertCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Single Column Viewport */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-4 overflow-y-auto max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 bg-slate-100 dark:bg-slate-950 px-4 py-2 flex items-center justify-between text-[9px] text-slate-500">
        <div className="flex items-center gap-2">
          <span>System Online</span>
          <span className="text-slate-355">|</span>
          <span>Version 1.0.0</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>Shield Active</span>
        </div>
      </footer>
    </div>
  )
}
export default Layout
