import React from 'react'
import { Activity, CheckCircle2, XOctagon, AlertTriangle } from 'lucide-react'

interface StatsCardsProps {
  totalCount: number
  onlineCount: number
  offlineCount: number
  alertCount: number
}

export function StatsCards({ totalCount, onlineCount, offlineCount, alertCount }: StatsCardsProps) {
  const stats = [
    {
      label: 'Total Endpoints',
      value: totalCount,
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/10'
    },
    {
      label: 'Online',
      value: onlineCount,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/10'
    },
    {
      label: 'Offline',
      value: offlineCount,
      icon: XOctagon,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/10'
    },
    {
      label: 'Active Alerts',
      value: alertCount,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/10'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, idx) => {
        const Icon = stat.icon
        return (
          <div
            key={idx}
            className={`glass-card p-6 rounded-2xl flex items-center justify-between border ${stat.borderColor}`}
          >
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {stat.label}
              </span>
              <div className="text-3xl font-bold tracking-tight text-white">
                {stat.value}
              </div>
            </div>
            <div className={`p-4 rounded-xl ${stat.bgColor} ${stat.color} border border-white/5`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default StatsCards
