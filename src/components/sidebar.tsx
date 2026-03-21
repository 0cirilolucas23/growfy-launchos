"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Search, Calculator, Settings,
  LogOut, Zap, Users, CreditCard, BarChart2,
  Bell, Webhook, FileText, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth-service";
import { useWorkspace } from "@/contexts/workspace-context";

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
    </svg>
  );
}

const sections = [
  { label: "Principal", items: [{ href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard }] },
  { label: "Canais", items: [{ href: "/dashboard/meta-ads", label: "Meta Ads", icon: MetaIcon }, { href: "/dashboard/google-ads", label: "Google Ads", icon: Search }] },
  { label: "Gestão", items: [{ href: "/dashboard/clientes", label: "Clientes", icon: Users }, { href: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard }, { href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart2 }] },
  { label: "Sistema", items: [{ href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook }, { href: "/dashboard/notificacoes", label: "Notificações", icon: Bell }, { href: "/dashboard/docs", label: "Documentação", icon: FileText }] },
  { label: "Planejamento", items: [{ href: "/dashboard/planning", label: "Eng. Reversa", icon: Calculator }] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWorkspace, workspaces } = useWorkspace();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-[200px] shrink-0 flex-col border-r border-white/[0.06] bg-[#08080A]">
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shrink-0">
          <Zap className="h-3.5 w-3.5 text-[#08080A]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white leading-none tracking-tight">Growfy</p>
          <p className="text-[10px] text-white/25 leading-none mt-0.5">LaunchOS</p>
        </div>
      </div>

      {activeWorkspace && (
        <button onClick={() => router.push("/workspace")}
          className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.03] transition-all group w-full text-left">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white"
            style={{ backgroundColor: activeWorkspace.color }}>
            {activeWorkspace.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/70 truncate leading-none">{activeWorkspace.name}</p>
            {workspaces.length > 1 && <p className="text-[9px] text-white/25 leading-none mt-0.5">Trocar workspace</p>}
          </div>
          {workspaces.length > 1 && <ChevronDown className="h-3 w-3 text-white/20 shrink-0" />}
        </button>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                      active ? "bg-white text-[#08080A]" : "text-white/40 hover:bg-white/[0.05] hover:text-white/70")}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-3 space-y-0.5">
        <Link href="/dashboard/settings"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/30 hover:bg-white/[0.05] hover:text-white/60 transition-all">
          <Settings className="h-3.5 w-3.5 shrink-0" />
          Configurações
        </Link>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/30 hover:bg-white/[0.05] hover:text-white/60 transition-all">
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
}