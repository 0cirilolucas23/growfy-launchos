"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Download, Filter, ChevronUp, ChevronDown,
  Users, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/metrics-service";

import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useWorkspace } from "@/contexts/workspace-context";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Platform = "hotmart" | "kiwify" | "eduzz" | "all";
type Status = "approved" | "refunded" | "cancelled" | "pending" | "all";
type SortKey = "customerName" | "amount" | "timestamp" | "platform";
type SortDir = "asc" | "desc";

interface Client {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productName: string;
  platform: Exclude<Platform, "all">;
  status: Exclude<Status, "all">;
  amount: number;
  timestamp: Date;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

// ─────────────────────────────────────────────
// Mock data from Firestore (replace with real query)
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<Exclude<Status, "all">, { label: string; color: string }> = {
  approved: { label: "Ativo", color: "#00D861" },
  refunded: { label: "Reembolsado", color: "#E85D22" },
  cancelled: { label: "Cancelado", color: "#E85D22" },
  pending: { label: "Pendente", color: "#FAE125" },
};

const PLATFORM_CONFIG: Record<Exclude<Platform, "all">, { label: string }> = {
  hotmart: { label: "Hotmart" },
  kiwify: { label: "Kiwify" },
  eduzz: { label: "Eduzz" },
};

function exportToCSV(clients: Client[]) {
  const headers = [
    "Nome", "Email", "Telefone", "Produto", "Plataforma",
    "Status", "Valor", "Data", "UTM Source", "UTM Medium",
    "UTM Campaign", "UTM Content",
  ];

  const rows = clients.map((c) => [
    c.customerName,
    c.customerEmail,
    c.customerPhone ?? "",
    c.productName,
    c.platform,
    STATUS_CONFIG[c.status].label,
    c.amount.toFixed(2),
    c.timestamp.toLocaleDateString("pt-BR"),
    c.utmSource ?? "",
    c.utmMedium ?? "",
    c.utmCampaign ?? "",
    c.utmContent ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: Exclude<Status, "all"> }) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
      style={{ borderColor: `${color}30`, color }}
    >
      {label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: Exclude<Platform, "all"> }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-white/40 uppercase">
      {PLATFORM_CONFIG[platform].label}
    </span>
  );
}

function SortButton({
  column, current, dir, onClick,
}: {
  column: SortKey; current: SortKey; dir: SortDir; onClick: () => void;
}) {
  const active = column === current;
  return (
    <button onClick={onClick} className="flex items-center gap-1 hover:text-white/60 transition-colors">
      {active
        ? dir === "asc"
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        : <ChevronDown className="h-3 w-3 opacity-20" />
      }
    </button>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [status, setStatus] = useState<Status>("all");
  const [period, setPeriod] = useState<"7" | "30" | "60" | "all">("30");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;
  const { activeWorkspace } = useWorkspace();
const workspaceId = activeWorkspace?.id ?? null;

useEffect(() => {
  if (!workspaceId) return;
  setIsLoading(true);
  const q = query(
    collection(db, "webhook_events"),
    where("workspaceId", "==", workspaceId),
    where("source", "==", "kiwify")
  );
  getDocs(q).then((snap) => {
    const data: Client[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        customerName: d.customerName ?? "",
        customerEmail: d.customerEmail ?? "",
        customerPhone: d.customerPhone ?? "",
        productName: d.productName ?? "",
        platform: (d.source ?? "kiwify") as "hotmart" | "kiwify" | "eduzz",
status: (d.status === "approved" ? "approved" : d.status === "refunded" ? "refunded" : "pending") as "approved" | "refunded" | "cancelled" | "pending",
        amount: d.amount ?? 0,
        timestamp: d.timestamp instanceof Timestamp ? d.timestamp.toDate() : new Date(d.timestamp),
        utmSource: d.utmSource ?? "",
        utmMedium: d.utmMedium ?? "",
        utmCampaign: d.utmCampaign ?? "",
        utmContent: d.utmContent ?? "",
      };
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  .filter((c) => c.amount > 0)
    setClients(data);
    setIsLoading(false);
  }).catch(() => setIsLoading(false));
}, [workspaceId]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = useMemo(() => {
    const cutoff = new Date();
if (period !== "all") {
  cutoff.setDate(cutoff.getDate() - parseInt(period));
  cutoff.setHours(0, 0, 0, 0);
}

    return clients
      .filter((c) => {
        if (platform !== "all" && c.platform !== platform) return false;
        if (status !== "all" && c.status !== status) return false;
        if (period !== "all" && c.timestamp < cutoff) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!c.customerName.toLowerCase().includes(q) &&
            !c.customerEmail.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "customerName") cmp = a.customerName.localeCompare(b.customerName);
        if (sortKey === "amount") cmp = a.amount - b.amount;
        if (sortKey === "timestamp") cmp = a.timestamp.getTime() - b.timestamp.getTime();
        if (sortKey === "platform") cmp = a.platform.localeCompare(b.platform);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [clients, search, platform, status, period, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totalRevenue = filtered
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="flex-1 space-y-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <Users className="h-4 w-4 text-white/50" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Clientes</h1>
            <p className="text-[11px] text-white/25">
              {filtered.length} clientes · {formatCurrency(totalRevenue)} em vendas aprovadas
            </p>
          </div>
        </div>
        <button
          onClick={() => exportToCSV(filtered)}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.06] hover:text-white/80 transition-all"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="h-3.5 w-3.5 text-white/20 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-white/20 outline-none"
          />
        </div>

        {/* Platform filter */}
        <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
          {(["all", "hotmart", "kiwify", "eduzz"] as Platform[]).map((p) => (
            <button key={p} onClick={() => { setPlatform(p); setPage(1); }}
              className={cn("rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all capitalize",
                platform === p ? "bg-white text-[#08080A]" : "text-white/30 hover:text-white/60")}>
              {p === "all" ? "Todos" : PLATFORM_CONFIG[p].label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
          {(["all", "approved", "pending", "refunded"] as Status[]).map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn("rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                status === s ? "bg-white text-[#08080A]" : "text-white/30 hover:text-white/60")}>
              {s === "all" ? "Todos" : STATUS_CONFIG[s as Exclude<Status, "all">].label}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
          {([{ label: "7d", value: "7" }, { label: "30d", value: "30" }, { label: "60d", value: "60" }, { label: "Tudo", value: "all" }] as const).map((p) => (
            <button key={p.value} onClick={() => { setPeriod(p.value); setPage(1); }}
              className={cn("rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                period === p.value ? "bg-white text-[#08080A]" : "text-white/30 hover:text-white/60")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 text-white/20 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/25">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    { key: "customerName" as SortKey, label: "Cliente" },
                    { key: null, label: "Produto" },
                    { key: "platform" as SortKey, label: "Plataforma" },
                    { key: null, label: "Status" },
                    { key: "amount" as SortKey, label: "Valor" },
                    { key: "timestamp" as SortKey, label: "Data" },
                    { key: null, label: "UTM" },
                  ].map((col) => (
                    <th key={col.label}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/20 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.key && (
                          <SortButton
                            column={col.key} current={sortKey}
                            dir={sortDir} onClick={() => handleSort(col.key!)}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((client) => (
                  <tr key={client.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    {/* Cliente */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white/80 truncate max-w-[160px]">{client.customerName}</p>
                      <p className="text-white/30 truncate max-w-[160px]">{client.customerEmail}</p>
                      {client.customerPhone && (
                        <p className="text-white/20 text-[10px]">{client.customerPhone}</p>
                      )}
                    </td>
                    {/* Produto */}
                    <td className="px-4 py-3">
                      <p className="text-white/60 truncate max-w-[140px]">{client.productName}</p>
                    </td>
                    {/* Plataforma */}
                    <td className="px-4 py-3">
                      <PlatformBadge platform={client.platform} />
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                    {/* Valor */}
                    <td className="px-4 py-3 font-bold text-white/80 tabular-nums whitespace-nowrap">
                      {formatCurrency(client.amount)}
                    </td>
                    {/* Data */}
                    <td className="px-4 py-3 text-white/40 whitespace-nowrap">
                      {client.timestamp.toLocaleDateString("pt-BR")}
                    </td>
                    {/* UTM */}
                    <td className="px-4 py-3">
                      {client.utmCampaign && (
                        <div className="space-y-0.5">
                          <p className="text-white/30 truncate max-w-[120px]" title={client.utmCampaign}>
                            {client.utmCampaign}
                          </p>
                          {client.utmContent && (
                            <p className="text-white/20 text-[10px] truncate max-w-[120px]" title={client.utmContent}>
                              {client.utmContent}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-white/30">
          <span>
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-white/[0.07] px-3 py-1.5 hover:bg-white/[0.05] disabled:opacity-30 transition-all"
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("rounded-lg border px-3 py-1.5 transition-all",
                    page === p
                      ? "border-white/20 bg-white/[0.08] text-white"
                      : "border-white/[0.07] hover:bg-white/[0.05]")}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-white/[0.07] px-3 py-1.5 hover:bg-white/[0.05] disabled:opacity-30 transition-all"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}