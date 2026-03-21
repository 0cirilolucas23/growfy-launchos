"use client";

import { useState } from "react";
import { Search, Bell, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function DashboardHeader() {
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);

  const name = user?.displayName ?? "Usuário";
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const email = user?.email ?? "Admin";

  return (
    <header className="flex h-14 items-center gap-4 border-b border-white/[0.06] bg-[#08080A] px-5">
      <div className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 max-w-xs transition-all",
        focused ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] bg-white/[0.03]"
      )}>
        <Search className="h-3.5 w-3.5 shrink-0 text-white/20" />
        <input type="text" placeholder="Buscar campanhas, métricas..."
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-xs text-white placeholder:text-white/20 outline-none" />
        <kbd className="hidden sm:flex items-center rounded border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/20">⌘K</kbd>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <ThemeToggle size="sm" />
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.05] hover:text-white/60 transition-all">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/60" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.05] hover:text-white/60 transition-all">
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-white/[0.08]" />

      <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05] transition-all">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#08080A]">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-white leading-none">{name}</p>
          <p className="text-[10px] text-white/25 leading-none mt-0.5 truncate max-w-[90px]">{email}</p>
        </div>
        <ChevronDown className="h-3 w-3 text-white/20" />
      </button>
    </header>
  );
}