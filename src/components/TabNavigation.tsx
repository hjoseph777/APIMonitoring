import React, { useState } from 'react'
import { Menu, X, Monitor, AlertTriangle, Terminal, Settings, BarChart3 } from 'lucide-react'

interface TabNavigationProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  alertCount: number
}

export function TabNavigation({ activeTab, setActiveTab, alertCount }: TabNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Monitor },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="relative w-full border-b border-slate-800 bg-slate-900/40 px-4 md:px-6">
      <div className="flex items-center justify-between h-14">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-8 h-full">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 h-full px-1 text-sm font-medium transition-all duration-200 ${
                  isActive ? 'text-blue-500 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white leading-none">
                    {tab.badge}
                  </span>
                ) : null}
                {/* Underline bar */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full animate-fade-in" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden items-center justify-between w-full">
          <span className="text-sm font-semibold capitalize text-slate-300">
            {activeTab}
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-slate-900 border-b border-slate-800 shadow-xl z-50 py-3 px-4 space-y-1 animate-slide-down">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setMobileMenuOpen(false)
                }}
                className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </div>
                {tab.badge && tab.badge > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default TabNavigation
