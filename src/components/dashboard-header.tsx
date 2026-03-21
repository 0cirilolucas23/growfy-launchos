"use client"

import { Bell, Search, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between px-8 py-4">
        {/* ---------------------------------------- */}
        {/* SEARCH BAR */}
        {/* ---------------------------------------- */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Buscar campanhas, métricas..."
              className="
                w-full pl-10 pr-4 py-2.5 
                bg-surface border border-input rounded-md
                text-foreground placeholder-muted-foreground
                focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                transition-all duration-200
                text-sm
              "
            />
          </div>
        </div>

        {/* ---------------------------------------- */}
        {/* ACTIONS */}
        {/* ---------------------------------------- */}
        <div className="flex items-center space-x-4 ml-8">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notificações"
          >
            <Bell size={20} />
            {/* Badge */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Configurações"
          >
            <Settings size={20} />
          </Button>

          {/* Divider */}
          <div className="w-px h-8 bg-border"></div>

          {/* User Profile */}
          <Button
            variant="ghost"
            className="flex items-center space-x-3 px-3"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-brand-purple to-brand-green rounded-full flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-sm font-medium">
                Usuário Demo
              </p>
              <p className="text-xs text-muted-foreground">
                Admin
              </p>
            </div>
          </Button>
        </div>
      </div>
    </header>
  )
}
