import React, { createContext, useContext, useState, useCallback } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6)
    
    setToasts((prev) => [...prev, { id, message, type, duration }])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container overlay */}
      <div 
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full select-none"
        role="live"
        aria-live="assertive"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [progress, setProgress] = useState(100)

  React.useEffect(() => {
    if (!toast.duration) return
    const startTime = Date.now()
    const endTime = startTime + toast.duration
    
    const interval = setInterval(() => {
      const remaining = endTime - Date.now()
      const percentage = (remaining / toast.duration!) * 100
      if (percentage <= 0) {
        clearInterval(interval)
        setProgress(0)
      } else {
        setProgress(percentage)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [toast.duration])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-400" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getBgStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-slate-900 border-green-500/20 text-slate-100 shadow-emerald-500/5'
      case 'error':
        return 'bg-slate-900 border-red-500/20 text-slate-100 shadow-rose-500/5'
      case 'warning':
        return 'bg-slate-900 border-yellow-500/20 text-slate-100 shadow-amber-500/5'
      case 'info':
      default:
        return 'bg-slate-900 border-slate-800 text-slate-100 shadow-blue-500/5'
    }
  }

  const getProgressColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-500'
      case 'error':
        return 'bg-rose-500'
      case 'warning':
        return 'bg-amber-500'
      case 'info':
      default:
        return 'bg-blue-500'
    }
  }

  return (
    <div
      className={`p-4 border rounded-2xl shadow-lg relative overflow-hidden flex items-start justify-between gap-4 transition-all duration-300 transform translate-y-0 animate-slide-in-right ${getBgStyle()}`}
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <div className="flex gap-3 min-w-0">
        <div className="shrink-0">{getIcon()}</div>
        <p className="text-xs font-semibold leading-normal break-words">{toast.message}</p>
      </div>

      <button
        onClick={() => onClose(toast.id)}
        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all shrink-0"
        aria-label="Dismiss Notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Dismiss Progress bar */}
      {toast.duration && (
        <div 
          className={`absolute bottom-0 left-0 h-0.5 transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  )
}
