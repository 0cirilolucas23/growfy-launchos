"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingCart,
  MousePointerClick,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMetrics, DateRange } from "@/hooks/use-metrics";
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
} from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  accentColor: string;
  isLoading?: boolean;
}

function KPICard({
  label,
  value,
  change,
  icon,
  accentColor,
  isLoading,
}: KPICardProps) {
  const positive = change >= 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/8 bg-white/4 p-5",
        "backdrop-blur-sm transition-all duration-300",
        "hover:border-white/15 hover:bg-white/6"
      )}
    >
      {/* Accent strip */}
      <div
        className="absolute left-0 top-4 h-8 w-1 rounded-r-full"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-white/10" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1">
            {positive ? (
              <ArrowUpRight className="h-3 w-3 text-[#00D861]" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-[#E85D22]" />
            )}
            <span
              className={cn(
                "text-xs font-semibold",
                positive ? "text-[#00D861]" : "text-[#E85D22]"
              )}
            >
              {positive ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">vs período ant.</span>
          </div>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <div style={{ color: accentColor }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

function DateRangeSelector({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const ranges: { label: string; value: DateRange }[] = [
    { label: "7d", value: "7d" },
    { label: "14d", value: "14d" },
    { label: "30d", value: "30d" },
    { label: "90d", value: "90d" },
  ];

  return (
    <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            value === r.value
              ? "bg-[#5050F2] text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// Custom Recharts tooltip
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D0D10] p-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground capitalize">{item.name}:</span>
          <span className="font-semibold text-foreground">
            {item.name === "revenue" || item.name === "adSpend"
              ? formatCurrency(item.value)
              : formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const {
    revenue,
    conversions,
    ads,
    chartData,
    topProducts,
    isLoading,
    isRefreshing,
    lastUpdated,
    refresh,
    setDateRange: applyDateRange,
  } = useMetrics({ dateRange, useMock: true });

  function handleRangeChange(r: DateRange) {
    setDateRange(r);
    applyDateRange(r);
  }

  const kpis: KPICardProps[] = [
    {
      label: "Receita Líquida",
      value: formatCurrency(revenue.netRevenue),
      change: revenue.growthRate,
      icon: <DollarSign className="h-5 w-5" />,
      accentColor: "#00D861",
    },
    {
      label: "Leads Gerados",
      value: formatNumber(conversions.leads),
      change: 12.4,
      icon: <Users className="h-5 w-5" />,
      accentColor: "#5050F2",
    },
    {
      label: "Conversões",
      value: formatPercentage(conversions.overallConversionRate),
      change: -2.1,
      icon: <ShoppingCart className="h-5 w-5" />,
      accentColor: "#FAE125",
    },
    {
      label: "ROAS",
      value: `${ads.roas.toFixed(2)}x`,
      change: 8.7,
      icon: <TrendingUp className="h-5 w-5" />,
      accentColor: "#E85D22",
    },
    {
      label: "Custo por Lead",
      value: formatCurrency(conversions.costPerLead),
      change: -5.3,
      icon: <MousePointerClick className="h-5 w-5" />,
      accentColor: "#5050F2",
    },
    {
      label: "CTR",
      value: formatPercentage(ads.ctr),
      change: 1.8,
      icon: <Zap className="h-5 w-5" />,
      accentColor: "#00D861",
    },
  ];

  // Simplify chart dates to DD/MM
  const formattedChartData = chartData.map((d) => ({
    ...d,
    date: d.date.slice(5).replace("-", "/"),
  }));

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lastUpdated
              ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Carregando dados..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector value={dateRange} onChange={handleRangeChange} />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            onClick={refresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} isLoading={isLoading} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Revenue + Leads Area Chart (3/5 width) */}
        <div className="lg:col-span-3 rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Receita × Leads
            </h2>
            <span className="rounded-full bg-[#5050F2]/15 px-2 py-0.5 text-xs font-medium text-[#5050F2]">
              Últimos {dateRange}
            </span>
          </div>
          {isLoading ? (
            <div className="h-52 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={formattedChartData}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D861" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00D861" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5050F2" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#5050F2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="left"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <YAxis
                  yAxisId="leads"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#00D861"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                  name="revenue"
                />
                <Area
                  yAxisId="leads"
                  type="monotone"
                  dataKey="leads"
                  stroke="#5050F2"
                  strokeWidth={2}
                  fill="url(#gradLeads)"
                  name="leads"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Conversions Bar Chart (2/5 width) */}
        <div className="lg:col-span-2 rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Conversões Diárias
            </h2>
          </div>
          {isLoading ? (
            <div className="h-52 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={formattedChartData.slice(-14)}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="conversions"
                  fill="#FAE125"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  name="conversions"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row: Top Products + Ad Performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Top Produtos
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-white/5"
                />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => {
                const max = topProducts[0]?.revenue ?? 1;
                const pct = (product.revenue / max) * 100;
                return (
                  <div key={product.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-right font-mono text-muted-foreground">
                          {index + 1}
                        </span>
                        <span
                          className="max-w-[160px] truncate font-medium text-foreground"
                          title={product.name}
                        >
                          {product.name}
                        </span>
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {product.source}
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(product.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[#5050F2] transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ad Performance */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Performance de Anúncios
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Investimento", value: formatCurrency(ads.spend), color: "#E85D22" },
              { label: "ROAS", value: `${ads.roas.toFixed(2)}x`, color: "#00D861" },
              { label: "CPC", value: formatCurrency(ads.cpc), color: "#5050F2" },
              { label: "CPM", value: formatCurrency(ads.cpm), color: "#FAE125" },
              { label: "CTR", value: formatPercentage(ads.ctr), color: "#00D861" },
              { label: "Frequência", value: ads.frequency.toFixed(1), color: "#5050F2" },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-white/8 bg-white/4 p-3"
              >
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                {isLoading ? (
                  <div className="mt-1.5 h-5 w-16 animate-pulse rounded bg-white/10" />
                ) : (
                  <p
                    className="mt-1 text-base font-bold"
                    style={{ color: metric.color }}
                  >
                    {metric.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
