"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, Wifi, WifiOff, Calendar, ChevronDown, X } from "lucide-react";
import { generateMockChannelData, ChannelData } from "@/lib/channel-service";
import { ChannelDashboard } from "@/components/channel-dashboard";
import type { MetaAdsDashboardData, MetaDateRange } from "@/lib/meta-ads-service";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Date Range Picker
// ─────────────────────────────────────────────

const PRESETS = [
  { label: "Hoje", value: "today" },
  { label: "7 dias", value: "7d" },
  { label: "14 dias", value: "14d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
  { label: "Personalizado", value: "custom" },
];

function getPresetDates(preset: string): MetaDateRange {
  const until = new Date();
  const since = new Date();
  switch (preset) {
    case "today": break;
    case "7d": since.setDate(since.getDate() - 7); break;
    case "14d": since.setDate(since.getDate() - 14); break;
    case "30d": since.setDate(since.getDate() - 30); break;
    case "90d": since.setDate(since.getDate() - 90); break;
    default: since.setDate(since.getDate() - 30);
  }
  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
}

function DateRangePicker({ onChange }: { onChange: (range: MetaDateRange) => void }) {
  const [preset, setPreset] = useState("30d");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handlePreset(value: string) {
    if (value === "custom") {
      setShowDropdown((v) => !v);
      return;
    }
    setPreset(value);
    setShowDropdown(false);
    onChange(getPresetDates(value));
  }

  function applyCustom() {
    if (customSince && customUntil) {
      setPreset("custom");
      setShowDropdown(false);
      onChange({ since: customSince, until: customUntil });
    }
  }

  const displayLabel = preset === "custom" && customSince && customUntil
    ? `${customSince.slice(5).replace("-","/")}/${customSince.slice(0,4)} → ${customUntil.slice(5).replace("-","/")}/${customUntil.slice(0,4)}`
    : "Personalizado";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <div key={p.value} className="relative" ref={p.value === "custom" ? dropdownRef : undefined}>
          <button
            onClick={() => handlePreset(p.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all border",
              preset === p.value
                ? "bg-white text-[#08080A] border-white"
                : "border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/70"
            )}>
            {p.value === "custom" && <Calendar className="h-3 w-3" />}
            {p.value === "custom" ? displayLabel : p.label}
            {p.value === "custom" && (
              <ChevronDown className={cn("h-3 w-3 transition-transform", showDropdown && "rotate-180")} />
            )}
          </button>

          {/* Dropdown com dois calendários lado a lado */}
          {p.value === "custom" && showDropdown && (
            <div className="absolute left-0 top-full mt-1.5 z-50 rounded-xl border border-white/[0.10] bg-[#0D0D10] p-4 shadow-2xl">
              <div className="flex gap-4">
                {/* De */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30">
                    De
                  </label>
                  <input
                    type="date"
                    value={customSince}
                    onChange={(e) => setCustomSince(e.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20 [color-scheme:dark]"
                  />
                </div>

                {/* Divisor */}
                <div className="flex items-end pb-2">
                  <span className="text-white/20 text-sm">→</span>
                </div>

                {/* Até */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Até
                  </label>
                  <input
                    type="date"
                    value={customUntil}
                    onChange={(e) => setCustomUntil(e.target.value)}
                    min={customSince}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20 [color-scheme:dark]"
                  />
                </div>
              </div>

              <button
                onClick={applyCustom}
                disabled={!customSince || !customUntil}
                className="mt-3 w-full rounded-lg bg-white py-2 text-[11px] font-bold text-[#08080A] hover:bg-white/90 disabled:opacity-40 transition-all"
              >
                Aplicar período
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────

type FilterLevel = "campaign" | "adset" | "ad";

interface FilterState {
  level: FilterLevel;
  search: string;
  minRoas: string;
  minSpend: string;
}

function Filters({
  filters,
  onChange,
  campaigns,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  campaigns: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Level tabs */}
      <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
        {([
          { value: "campaign", label: "Campanhas" },
          { value: "adset", label: "Públicos" },
          { value: "ad", label: "Criativos" },
        ] as const).map((tab) => (
          <button key={tab.value}
            onClick={() => onChange({ ...filters, level: tab.value })}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
              filters.level === tab.value
                ? "bg-white text-[#08080A]"
                : "text-white/30 hover:text-white/60"
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por nome..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white placeholder:text-white/20 outline-none focus:border-white/15 transition-all w-48"
      />

      {/* Min ROAS */}
      <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
        <span className="text-[11px] text-white/30">ROAS ≥</span>
        <input
          type="number"
          placeholder="0"
          value={filters.minRoas}
          onChange={(e) => onChange({ ...filters, minRoas: e.target.value })}
          className="w-12 bg-transparent text-[11px] text-white outline-none"
          min="0" step="0.1"
        />
      </div>

      {/* Min Spend */}
      <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
        <span className="text-[11px] text-white/30">Invest. ≥ R$</span>
        <input
          type="number"
          placeholder="0"
          value={filters.minSpend}
          onChange={(e) => onChange({ ...filters, minSpend: e.target.value })}
          className="w-16 bg-transparent text-[11px] text-white outline-none"
          min="0"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────

function getRoasBadge(roas: number) {
  if (roas >= 3) return { label: "Ótimo", color: "#00D861" };
  if (roas >= 1.5) return { label: "Bom", color: "#FAE125" };
  return { label: "Baixo", color: "#E85D22" };
}

function MetaTable({ rows }: {
  rows: Array<{
    id: string; name: string; subName?: string;
    spend: number; impressions: number; clicks: number;
    ctr: number; cpc: number; leads: number;
    purchases: number; roas: number; hookRate?: number;
  }>;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-white/20">Nenhum resultado encontrado</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {["Nome", "Invest.", "Impressões", "Cliques", "CTR", "CPC", "Leads", "Vendas", "ROAS", "Gancho", "Status"].map((col) => (
              <th key={col} className={cn(
                "pb-2.5 pr-4 text-[10px] font-bold uppercase tracking-wider text-white/20 whitespace-nowrap",
                col === "Nome" ? "text-left" : "text-right"
              )}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = getRoasBadge(row.roas);
            return (
              <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="py-3 pr-4">
                  <p className="font-semibold text-white/80 truncate max-w-[200px]" title={row.name}>{row.name}</p>
                  {row.subName && <p className="text-[10px] text-white/25 truncate max-w-[200px]">{row.subName}</p>}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatCurrency(row.spend)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatNumber(row.impressions)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatNumber(row.clicks)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatPercentage(row.ctr)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatCurrency(row.cpc)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatNumber(row.leads)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">{formatNumber(row.purchases)}</td>
                <td className="py-3 pr-4 text-right tabular-nums font-bold text-white/80">{row.roas.toFixed(2)}x</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/60">
                  {row.hookRate !== undefined ? formatPercentage(row.hookRate) : "—"}
                </td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold"
                    style={{ borderColor: `${badge.color}30`, color: badge.color }}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────

function KPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/20">{label}</p>
      <p className="mt-1.5 text-xl font-black text-white">{value}</p>
      <div className="mt-1.5 h-0.5 w-8 rounded-full" style={{ backgroundColor: accent }} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Chart Tooltip
// ─────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-3 shadow-xl text-xs">
      <p className="mb-2 text-white/30">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-white/30 capitalize">{item.name}:</span>
          <span className="font-bold text-white">{formatCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function MetaAdsPage() {
  const [apiData, setApiData] = useState<MetaAdsDashboardData | null>(null);
  const [mockData] = useState(() => generateMockChannelData("meta", 14));
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<MetaDateRange>(getPresetDates("30d"));
  const [filters, setFilters] = useState<FilterState>({
    level: "campaign",
    search: "",
    minRoas: "",
    minSpend: "",
  });

  const loadData = useCallback(async (range: MetaDateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        since: range.since,
        until: range.until,
      });
      const res = await fetch(`/api/meta-ads?${params}`);
      const json = await res.json() as MetaAdsDashboardData & { error?: string };
      if (json.error) throw new Error(json.error);
      setApiData(json);
      setIsLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(dateRange); }, []);

  function handleDateChange(range: MetaDateRange) {
    setDateRange(range);
    loadData(range);
  }

  // Build table rows based on filter level
  function getTableRows() {
    if (!apiData) return [];

    const search = filters.search.toLowerCase();
    const minRoas = parseFloat(filters.minRoas) || 0;
    const minSpend = parseFloat(filters.minSpend) || 0;

    if (filters.level === "campaign") {
      return apiData.campaigns
        .filter((r) => r.name.toLowerCase().includes(search))
        .filter((r) => r.roas >= minRoas && r.spend >= minSpend)
        .map((r) => ({ ...r, hookRate: r.hookRate }));
    }

    if (filters.level === "adset") {
      return apiData.adsets
        .filter((r) => r.name.toLowerCase().includes(search) || r.campaignName.toLowerCase().includes(search))
        .filter((r) => r.roas >= minRoas && r.spend >= minSpend)
        .map((r) => ({ ...r, subName: r.campaignName, hookRate: undefined }));
    }

    // ads (criativos)
    return apiData.ads
      .filter((r) => r.name.toLowerCase().includes(search) || r.adsetName.toLowerCase().includes(search))
      .filter((r) => r.roas >= minRoas && r.spend >= minSpend)
      .map((r) => ({ ...r, subName: `${r.campaignName} → ${r.adsetName}` }));
  }

  const metrics = apiData?.metrics;
  const chartData = (apiData?.chartData ?? []).map((d) => ({
    ...d,
    date: d.date.slice(5).replace("-", "/"),
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className={cn(
        "flex items-center gap-2 px-6 py-1.5 text-xs border-b shrink-0",
        isLive
          ? "bg-[#00D861]/5 border-[#00D861]/15 text-[#00D861]/70"
          : "bg-[#FAE125]/5 border-[#FAE125]/15 text-[#FAE125]/70"
      )}>
        {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        <span>{isLive ? "Dados reais — API do Meta" : `Dados simulados${error ? ` — ${error}` : ""}`}</span>
        <button onClick={() => loadData(dateRange)}
          className="ml-auto flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      <div className="flex-1 space-y-5 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/60">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
            </svg>
          </div>
          <h1 className="text-lg font-black text-white tracking-tight">Meta Ads</h1>
        </div>

        {/* Date range picker */}
        <DateRangePicker onChange={handleDateChange} />

        {/* KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPI label="Investimento" value={formatCurrency(metrics.spend)} accent="#E85D22" />
            <KPI label="Faturamento" value={formatCurrency(metrics.purchaseValue)} accent="#00D861" />
            <KPI label="Vendas" value={formatNumber(metrics.purchases)} accent="#5050F2" />
            <KPI label="Leads" value={formatNumber(metrics.leads)} accent="#5050F2" />
            <KPI label="ROAS" value={`${metrics.roas.toFixed(2)}x`} accent="#00D861" />
            <KPI label="CPA" value={formatCurrency(metrics.spend / Math.max(metrics.purchases, 1))} accent="#E85D22" />
            <KPI label="CTR" value={formatPercentage(metrics.ctr)} accent="#FAE125" />
            <KPI label="Taxa de Gancho" value={formatPercentage(metrics.hookRate)} accent="#FAE125" />
          </div>
        ) : null}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Investimento × Faturamento por dia</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="spend" stroke="#E85D22" strokeWidth={1.5} dot={false} name="investimento" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-white/25">
                <span className="h-px w-3 bg-[#E85D22]" /> Investimento
              </span>
            </div>
          </div>
        )}

        {/* Filters + Table */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Análise detalhada</h2>
          <Filters
            filters={filters}
            onChange={setFilters}
            campaigns={apiData?.campaigns.map((c) => c.name) ?? []}
          />
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />
          ) : (
            <MetaTable rows={getTableRows()} />
          )}
        </div>
      </div>
    </div>
  );
}