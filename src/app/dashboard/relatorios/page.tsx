"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMetrics, DateRange } from "@/hooks/use-metrics";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatPercentage, formatNumber } from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

// ─── Helpers ───

function getPresetDates(preset: string): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  switch (preset) {
    case "7d":  since.setDate(since.getDate() - 7);  break;
    case "14d": since.setDate(since.getDate() - 14); break;
    case "30d": since.setDate(since.getDate() - 30); break;
    case "90d": since.setDate(since.getDate() - 90); break;
    default:    since.setDate(since.getDate() - 30);
  }
  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
}

function DeltaBadge({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-bold",
      pos ? "text-[#00D861]" : "text-[#E85D22]"
    )}>
      {pos
        ? <ArrowUpRight className="h-3 w-3" />
        : <ArrowDownRight className="h-3 w-3" />}
      {pos ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

// ─── Page ───

interface CampaignRow {
  id: string; name: string; spend: number;
  ctr: number; roas: number; purchases: number;
}

const PRESETS = [
  { label: "7 dias",  value: "7d"  },
  { label: "14 dias", value: "14d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
];

export default function RelatoriosPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [activeSince, setActiveSince] = useState<string | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [metaSpend, setMetaSpend] = useState(0);
  const [metaSessions, setMetaSessions] = useState(0);
  const { activeWorkspace } = useWorkspace();

  const {
    revenue, conversions, ads, chartData, topProducts, changes, isLoading,
    setDateRange: applyRange,
  } = useMetrics({
    dateRange,
    sinceDate: activeSince,
    workspaceId: activeWorkspace?.id ?? null,
  });

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const until = new Date().toISOString().split("T")[0];
    const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : 90;
    const since = activeSince ?? new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const params = new URLSearchParams({ since, until, workspaceId: activeWorkspace.id });
    apiFetch(`/api/meta-ads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.campaigns) setCampaigns(data.campaigns.slice(0, 5));
        if (data?.metrics?.spend) setMetaSpend(data.metrics.spend);
        if (data?.metrics?.landingPageViews) setMetaSessions(data.metrics.landingPageViews);
      })
      .catch(() => {});
  }, [activeWorkspace?.id, dateRange, activeSince]);

  function selectPreset(value: string) {
    const range = getPresetDates(value);
    setDateRange(value as DateRange);
    setActiveSince(range.since);
    applyRange(value as DateRange);
  }

  const lucro = revenue.totalRevenue - metaSpend;
  const taxaConversao = metaSessions > 0 ? (conversions.customers / metaSessions) * 100 : 0;
  const chart = chartData.map((d) => ({ ...d, date: d.date.slice(5).replace("-", "/") }));

  // Valor do período anterior: recalcula a partir da variação
  function prevVal(curr: number, pct: number): number | null {
    if (pct === 0) return null; // sem dado anterior ou variação exata de 0
    return curr / (1 + pct / 100);
  }

  const compRows = [
    {
      label: "Faturamento",
      curr: formatCurrency(revenue.totalRevenue),
      prev: prevVal(revenue.totalRevenue, changes.faturamento),
      fmt: (v: number) => formatCurrency(v),
      change: changes.faturamento,
    },
    {
      label: "Investimento",
      curr: metaSpend > 0 ? formatCurrency(metaSpend) : "—",
      prev: metaSpend > 0 ? prevVal(metaSpend, changes.investimento) : null,
      fmt: (v: number) => formatCurrency(v),
      change: changes.investimento,
    },
    {
      label: "Lucro",
      curr: metaSpend > 0 ? formatCurrency(lucro) : "—",
      prev: metaSpend > 0 ? prevVal(lucro, changes.lucro) : null,
      fmt: (v: number) => formatCurrency(v),
      change: changes.lucro,
    },
    {
      label: "ROAS",
      curr: ads.spend > 0 ? `${ads.roas.toFixed(2)}x` : "—",
      prev: ads.spend > 0 ? prevVal(ads.roas, changes.roas) : null,
      fmt: (v: number) => `${v.toFixed(2)}x`,
      change: changes.roas,
    },
    {
      label: "Vendas",
      curr: formatNumber(conversions.customers),
      prev: prevVal(conversions.customers, changes.vendas),
      fmt: (v: number) => formatNumber(Math.round(v)),
      change: changes.vendas,
    },
    {
      label: "Taxa de Conversão",
      curr: taxaConversao > 0 ? formatPercentage(taxaConversao) : "—",
      prev: taxaConversao > 0 ? prevVal(taxaConversao, changes.taxaConversao) : null,
      fmt: (v: number) => formatPercentage(v),
      change: changes.taxaConversao,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 space-y-5 p-6 overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Relatórios</h1>
            <p className="mt-0.5 text-[11px] text-white/25">Resumo executivo do período selecionado</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end print:hidden">
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => selectPreset(p.value)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition-all",
                    dateRange === p.value
                      ? "bg-white text-[#08080A] border-white"
                      : "border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/70"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { label: "Faturamento",   value: formatCurrency(revenue.totalRevenue),                              change: changes.faturamento,   color: "#00D861" },
            { label: "Investimento",  value: metaSpend > 0 ? formatCurrency(metaSpend) : "—",                  change: changes.investimento,  color: "#E85D22" },
            { label: "Lucro",         value: metaSpend > 0 ? formatCurrency(lucro) : "—",                      change: changes.lucro,         color: "#00D861" },
            { label: "ROAS",          value: ads.spend > 0 ? `${ads.roas.toFixed(2)}x` : "—",                  change: changes.roas,          color: "#00D861" },
            { label: "Vendas",        value: formatNumber(conversions.customers),                               change: changes.vendas,        color: "#5050F2" },
            { label: "Conv.",         value: taxaConversao > 0 ? formatPercentage(taxaConversao) : "—",         change: changes.taxaConversao, color: "#FAE125" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">{kpi.label}</p>
                <span className="h-1.5 w-1.5 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: kpi.color }} />
              </div>
              {isLoading
                ? <div className="h-5 w-16 animate-pulse rounded bg-white/[0.06] mb-1.5" />
                : <p className="text-lg font-black text-white tracking-tight mb-1.5">{kpi.value}</p>
              }
              {!isLoading && <DeltaBadge value={kpi.change} />}
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold text-white mb-4">Comparativo com Período Anterior</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left pb-3 text-[10px] font-bold uppercase tracking-wider text-white/25">Métrica</th>
                  <th className="text-right pb-3 text-[10px] font-bold uppercase tracking-wider text-white/25">Período Anterior</th>
                  <th className="text-right pb-3 text-[10px] font-bold uppercase tracking-wider text-white/25">Período Atual</th>
                  <th className="text-right pb-3 text-[10px] font-bold uppercase tracking-wider text-white/25">Variação</th>
                </tr>
              </thead>
              <tbody>
                {compRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]",
                    )}
                  >
                    <td className="py-3 text-white/60 font-medium">{row.label}</td>
                    <td className="py-3 text-right text-white/30">
                      {isLoading
                        ? <span className="inline-block h-3 w-14 animate-pulse rounded bg-white/[0.06]" />
                        : row.prev !== null ? row.fmt(row.prev) : "—"}
                    </td>
                    <td className="py-3 text-right text-white font-bold">
                      {isLoading
                        ? <span className="inline-block h-3 w-14 animate-pulse rounded bg-white/[0.06]" />
                        : row.curr}
                    </td>
                    <td className="py-3 text-right">
                      {isLoading
                        ? <span className="inline-block h-3 w-10 animate-pulse rounded bg-white/[0.06]" />
                        : <DeltaBadge value={row.change} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue chart */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold text-white mb-4">Faturamento no Período</h2>
          {isLoading
            ? <div className="h-48 animate-pulse rounded-lg bg-white/[0.04]" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="gRelRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00D861" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00D861" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }}
                    tickLine={false} axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }}
                    tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-3 shadow-2xl text-xs">
                          <p className="mb-1 text-white/30">{label}</p>
                          <p className="font-bold text-white">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone" dataKey="revenue"
                    stroke="#00D861" strokeWidth={1.5}
                    fill="url(#gRelRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Top campaigns + Top products */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Top Campanhas</h2>
            {campaigns.length === 0
              ? <p className="py-8 text-center text-xs text-white/20">Sem dados de campanhas</p>
              : (
                <div className="space-y-2">
                  {campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2.5 text-xs gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white/70 font-medium truncate">{c.name}</p>
                        <p className="text-white/25 mt-0.5">
                          {formatCurrency(c.spend)} · {c.ctr.toFixed(1)}% CTR
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white font-bold">{c.roas > 0 ? `${c.roas.toFixed(2)}x` : "—"}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">ROAS</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Top Produtos</h2>
            {topProducts.length === 0
              ? <p className="py-8 text-center text-xs text-white/20">Sem produtos — aguardando eventos reais</p>
              : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5 text-xs">
                      <span className="text-[10px] font-bold text-white/20 w-4 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/70 font-medium truncate">{p.name}</p>
                        <p className="text-white/25 mt-0.5 uppercase tracking-wider text-[10px]">{p.source}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white font-bold">{formatCurrency(p.revenue)}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{p.units} vendas</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

        </div>
      </div>
    </div>
  );
}
