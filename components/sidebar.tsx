"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Facebook,
  Globe,
  Calculator,
  ChevronRight,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ----------------------------------------
// MENU ITEMS
// ----------------------------------------

const menuItems = [
  {
    path: '/dashboard',
    label: 'Visão Geral',
    icon: LayoutDashboard,
  },
  {
    path: '/dashboard/meta-ads',
    label: 'Meta Ads',
    icon: Facebook,
  },
  {
    path: '/dashboard/google-ads',
    label: 'Google Ads',
    icon: Globe,
  },
  {
    path: '/dashboard/planning',
    label: 'Planejamento',
    icon: Calculator,
  },
]

// ----------------------------------------
// SIDEBAR COMPONENT
// ----------------------------------------

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-secondary border-r border-border flex flex-col z-50">
      {/* ---------------------------------------- */}
      {/* BRANDING / LOGO */}
      {/* ---------------------------------------- */}
      <div className="px-6 py-8 border-b border-border">
        <div className="flex items-center space-x-3">
          {/* Logo Icon */}
          <div className="w-10 h-10 bg-gradient-to-br from-brand-purple to-brand-orange rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          
          {/* Logo Text */}
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Growfy
          </h1>
        </div>
        
        {/* Subtitle */}
        <p className="text-muted-foreground text-sm mt-2 ml-13">
          LaunchOS
        </p>
      </div>

      {/* ---------------------------------------- */}
      {/* NAVIGATION MENU */}
      {/* ---------------------------------------- */}
      <nav className="flex-1 px-3 py-6 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path
            
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={cn(
                    "group flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-white hover:bg-surface"
                  )}
                >
                  {/* Icon + Label */}
                  <div className="flex items-center space-x-3">
                    <Icon
                      size={20}
                      className="transition-transform group-hover:scale-110"
                    />
                    <span className="font-medium text-sm">
                      {item.label}
                    </span>
                  </div>

                  {/* Chevron Indicator */}
                  <ChevronRight
                    size={16}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ---------------------------------------- */}
      {/* FOOTER */}
      {/* ---------------------------------------- */}
      <div className="px-3 py-4 border-t border-border space-y-2">
        {/* Settings */}
        <Link
          href="/dashboard/settings"
          className="flex items-center space-x-3 px-4 py-2 rounded-lg text-muted-foreground hover:text-white hover:bg-surface transition-colors"
        >
          <Settings size={18} />
          <span className="text-sm font-medium">Configurações</span>
        </Link>

        {/* Logout */}
        <button
          onClick={() => {
            // TODO: Implementar logout Firebase
            console.log('Logout')
          }}
          className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-surface transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  )
}
