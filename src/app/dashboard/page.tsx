"use client";

import React, { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { RefreshCw, ArrowUpRight, ArrowDownRight, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMetrics, DateRange } from "@/hooks/use-metrics";
import { useWorkspace } from "@/contexts/workspace-context";
import { formatCurrency, formatPercentage, formatNumber } from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

// ─── Sparkline ───
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── KPI Card ───
interface KPIProps {
  label: string; value: string; change: number;
  accentColor: string; sparkData?: number[]; isLoading?: boolean;
}

function KPICard({ label, value, change, accentColor, sparkData, isLoading }: KPIProps) {
  const pos = change >= 0;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">{label}</p>
        <span className="h-1.5 w-1.5 rounded-full mt-1" style={{ backgroundColor: accentColor }} />
      </div>
      {isLoading
        ? <div className="h-6 w-20 animate-pulse rounded bg-white/[0.06] mb-3" />
        : <p className="text-xl font-black text-white tracking-tight mb-2">{value}</p>
      }
      {sparkData && !isLoading && (
        <div className="-mx-1 mb-2"><Sparkline data={sparkData} color={accentColor} /></div>
      )}
      <div className="flex items-center gap-1">
        {pos ? <ArrowUpRight className="h-3 w-3 text-white/40" /> : <ArrowDownRight className="h-3 w-3 text-white/40" />}
        <span className={cn("text-[10px] font-bold", pos ? "text-white/60" : "text-white/40")}>
          {pos ? "+" : ""}{change.toFixed(1)}%
        </span>
        <span className="text-[10px] text-white/20">vs ant.</span>
      </div>
    </div>
  );
}

// ─── Date Range ───
function DateRangeSelector({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
      {(["7d", "14d", "30d", "90d"] as DateRange[]).map((r) => (
        <button key={r} onClick={() => onChange(r)}
          className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
            value === r ? "bg-white text-[#08080A]" : "text-white/30 hover:text-white/60")}>
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Tooltip ───
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-3 shadow-2xl text-xs">
      <p className="mb-2 text-white/30 font-medium">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-white/40 capitalize">{item.name}:</span>
          <span className="font-bold text-white">
            {item.name === "revenue" || item.name === "adSpend"
              ? formatCurrency(item.value) : formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ───
export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const { activeWorkspace } = useWorkspace();

  const { revenue, conversions, ads, chartData, topProducts, isLoading, isRefreshing, isLive, lastUpdated, refresh, setDateRange: applyRange } = useMetrics({
    dateRange,
    workspaceId: activeWorkspace?.id ?? null,
  });

  function handleRange(r: DateRange) { setDateRange(r); applyRange(r); }

  const revSpark = chartData.slice(-14).map(d => d.revenue);
  const leadSpark = chartData.slice(-14).map(d => d.leads);
  const convSpark = chartData.slice(-14).map(d => d.conversions);

  const kpis: KPIProps[] = [
    { label: "Receita Líquida", value: formatCurrency(revenue.netRevenue), change: revenue.growthRate, accentColor: "#00D861", sparkData: revSpark },
    { label: "Leads Gerados", value: formatNumber(conversions.leads), change: 12.4, accentColor: "#5050F2", sparkData: leadSpark },
    { label: "Conversões", value: formatPercentage(conversions.overallConversionRate), change: -2.1, accentColor: "#FAE125", sparkData: convSpark },
    { label: "ROAS", value: `${ads.roas.toFixed(2)}x`, change: 8.7, accentColor: "#00D861" },
    { label: "Custo por Lead", value: formatCurrency(conversions.costPerLead), change: -5.3, accentColor: "#E85D22" },
    { label: "CTR", value: formatPercentage(ads.ctr), change: 1.8, accentColor: "#5050F2" },
  ];

  const chart = chartData.map(d => ({ ...d, date: d.date.slice(5).replace("-", "/") }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Data source indicator */}
      <div className={cn(
        "flex items-center gap-2 px-6 py-1.5 text-xs border-b shrink-0",
        isLive
          ? "bg-[#00D861]/5 border-[#00D861]/15 text-[#00D861]/70"
          : "bg-white/[0.02] border-white/[0.04] text-white/20"
      )}>
        {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        <span>{isLive ? "Dados reais — Firestore" : "Dados simulados — aguardando eventos reais"}</span>
        {activeWorkspace && (
          <span className="ml-2 opacity-50">· {activeWorkspace.name}</span>
        )}
      </div>

      <div className="flex-1 space-y-5 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Visão Geral</h1>
            <p className="mt-0.5 text-[11px] text-white/25">
              {lastUpdated
                ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : "Carregando..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeSelector value={dateRange} onChange={handleRange} />
            <Button variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] text-white/40"
              onClick={refresh} disabled={isRefreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {kpis.map((k) => <KPICard key={k.label} {...k} isLoading={isLoading} />)}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Receita × Leads</h2>
              <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-white/30">
                Últimos {dateRange}
              </span>
            </div>
            {isLoading ? <div className="h-52 animate-pulse rounded-lg bg-white/[0.04]" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D861" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00D861" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5050F2" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#5050F2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="r" orientation="left" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <YAxis yAxisId="l" orientation="right" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area yAxisId="r" type="monotone" dataKey="revenue" stroke="#00D861" strokeWidth={1.5} fill="url(#gR)" name="revenue" />
                  <Area yAxisId="l" type="monotone" dataKey="leads" stroke="#5050F2" strokeWidth={1.5} fill="url(#gL)" name="leads" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-white/25"><span className="h-px w-4 bg-[#00D861]" /> Receita</span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/25"><span className="h-px w-4 bg-[#5050F2]" /> Leads</span>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Conversões Diárias</h2>
            {isLoading ? <div className="h-52 animate-pulse rounded-lg bg-white/[0.04]" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chart.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="conversions" fill="rgba(255,255,255,0.12)" radius={[3, 3, 0, 0]} maxBarSize={20} name="conversions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Top Produtos</h2>
            {isLoading
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-white/[0.04]" />)}</div>
              : topProducts.length === 0
                ? <p className="py-8 text-center text-xs text-white/20">Nenhum produto ainda — aguardando eventos reais</p>
                : <div className="space-y-3">
                    {topProducts.map((p, i) => {
                      const pct = (p.revenue / (topProducts[0]?.revenue ?? 1)) * 100;
                      return (
                        <div key={p.id} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-bold text-white/20 w-3 text-right shrink-0">{i + 1}</span>
                              <span className="text-xs font-semibold text-white/80 truncate">{p.name}</span>
                              <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-white/25 uppercase">{p.source}</span>
                            </div>
                            <span className="text-xs font-bold text-white shrink-0 ml-2">{formatCurrency(p.revenue)}</span>
                          </div>
                          <div className="h-px overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full bg-white/20 transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
            }
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Performance de Anúncios</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Investimento", value: formatCurrency(ads.spend), accent: "#E85D22" },
                { label: "ROAS", value: `${ads.roas.toFixed(2)}x`, accent: "#00D861" },
                { label: "CPC", value: formatCurrency(ads.cpc), accent: "#5050F2" },
                { label: "CPM", value: formatCurrency(ads.cpm), accent: "#FAE125" },
                { label: "CTR", value: formatPercentage(ads.ctr), accent: "#00D861" },
                { label: "Frequência", value: ads.frequency.toFixed(1), accent: "#5050F2" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/20">{m.label}</p>
                    <span className="h-1 w-1 rounded-full" style={{ backgroundColor: m.accent }} />
                  </div>
                  {isLoading
                    ? <div className="h-5 w-12 animate-pulse rounded bg-white/[0.06]" />
                    : <p className="text-sm font-black text-white">{m.value}</p>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}