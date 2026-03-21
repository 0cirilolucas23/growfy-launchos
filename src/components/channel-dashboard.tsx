"use client";

import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ChannelData, UTMDimension, UTMRow } from "@/lib/channel-service";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

function KPICard({ label, value, sub, change, accent }: {
  label: string; value: string; sub?: string; change?: number; accent: string;
}) {
  const pos = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">{label}</p>
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/25">{sub}</p>}
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {pos ? <ArrowUpRight className="h-3 w-3 text-white/40" /> : <ArrowDownRight className="h-3 w-3 text-white/40" />}
          <span className={cn("text-[10px] font-bold", pos ? "text-white/60" : "text-white/35")}>
            {pos ? "+" : ""}{change.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

function ProgressCard({ label, atual, meta, accent, formatter }: {
  label: string; atual: number; meta: number; accent: string; formatter: (v: number) => string;
}) {
  const pct = Math.min((atual / Math.max(meta, 1)) * 100, 100);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex justify-between mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/25">{label}</span>
        <span className="text-[10px] font-black text-white/60">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-white/20">
        <span>{formatter(atual)}</span>
        <span>Meta: {formatter(meta)}</span>
      </div>
    </div>
  );
}

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
          <span className="font-bold text-white">
            {item.name === "roas" ? `${item.value.toFixed(2)}x` : formatCurrency(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getRoasLabel(roas: number) {
  if (roas >= 3) return { label: "Ótimo", color: "#00D861" };
  if (roas >= 1.5) return { label: "Bom", color: "#FAE125" };
  return { label: "Baixo", color: "#E85D22" };
}

function UTMTable({ rows }: { rows: UTMRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {["Nome", "Invest.", "Vendas", "C/Sessão", "Gancho", "CTR", "CPA", "Faturamento", "Lucro", "Status"].map((col) => (
              <th key={col} className={cn("pb-2.5 pr-4 text-[10px] font-bold uppercase tracking-wider text-white/20 whitespace-nowrap",
                col === "Nome" ? "text-left" : "text-right")}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...rows].sort((a, b) => b.faturamento - a.faturamento).map((row, i) => {
            const roas = row.faturamento / Math.max(row.investimento, 1);
            const badge = getRoasLabel(roas);
            return (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="py-3 pr-4 font-semibold text-white/80 max-w-[140px] truncate" title={row.nome}>{row.nome}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/50">{formatCurrency(row.investimento)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/50">{formatNumber(row.vendas)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/50">{formatCurrency(row.custoPorSessao)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/50">{formatPercentage(row.taxaGancho)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/50">{formatPercentage(row.ctr)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/50">{formatCurrency(row.custoporCompra)}</td>
                <td className="py-3 pr-4 text-right tabular-nums font-semibold text-white/80">{formatCurrency(row.faturamento)}</td>
                <td className={cn("py-3 pr-4 text-right tabular-nums font-bold", row.lucro >= 0 ? "text-white/70" : "text-white/30")}>
                  {formatCurrency(row.lucro)}
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

interface ChannelDashboardProps {
  title: string; icon: React.ReactNode; accent: string;
  data: ChannelData; utmDimensions: { key: UTMDimension; label: string }[];
}

export function ChannelDashboard({ title, icon, accent, data, utmDimensions }: ChannelDashboardProps) {
  const { kpis, chartData, utmTables } = data;
  const [activeTab, setActiveTab] = useState<UTMDimension>(utmDimensions[0].key);

  return (
    <div className="flex-1 space-y-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/60">
          {icon}
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">{title}</h1>
          <p className="text-[11px] text-white/25">Dados simulados — integração API em breve</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Investimento" value={formatCurrency(kpis.investimento)} accent="#E85D22" change={-3.2} />
        <KPICard label="Faturamento" value={formatCurrency(kpis.faturamentoTotal)} accent="#00D861" change={14.5} />
        <KPICard label="Vendas (Ingressos)" value={formatNumber(kpis.vendasIngressos)} accent={accent} change={9.1} />
        <KPICard label="Order Bump" value={formatNumber(kpis.vendasOrderbump)} accent="#FAE125" change={6.3} />
        <KPICard label="CPA" value={formatCurrency(kpis.custoporCompra)} accent="#E85D22" sub="custo por compra" change={-8.4} />
        <KPICard label="ROAS" value={`${kpis.roas.toFixed(2)}x`} accent="#00D861" sub="retorno sobre ad spend" change={11.2} />
        <KPICard label="Lucro" value={formatCurrency(kpis.lucro)} accent={kpis.lucro >= 0 ? "#00D861" : "#E85D22"} />
        <KPICard label="Sessões" value={formatNumber(kpis.sessoes)} accent={accent} sub={`${formatNumber(kpis.initiateCheckouts)} ICs`} />
      </div>

      {/* Progress */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProgressCard label="Progresso Investimento" atual={kpis.progressoInvestimento.atual} meta={kpis.progressoInvestimento.meta} accent="#E85D22" formatter={formatCurrency} />
        <ProgressCard label="Progresso Faturamento" atual={kpis.progressoVendas.atual} meta={kpis.progressoVendas.meta} accent="#00D861" formatter={formatCurrency} />
      </div>

      {/* Funil */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sessões", value: formatNumber(kpis.sessoes), accent },
          { label: "Initiate Checkouts", value: formatNumber(kpis.initiateCheckouts), accent: "#FAE125" },
          { label: "Taxa Conv. PV", value: formatPercentage(kpis.taxaConversaoPV), accent: "#00D861" },
        ].map((f) => (
          <div key={f.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/20">{f.label}</p>
            <p className="mt-2 text-2xl font-black text-white">{f.value}</p>
            <div className="mt-1.5 flex justify-center">
              <span className="h-0.5 w-6 rounded-full" style={{ backgroundColor: f.accent }} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-bold text-white">Faturamento × Investimento por dia</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="m" orientation="left" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}x`} />
            <Tooltip content={<ChartTooltip />} />
            <Line yAxisId="m" type="monotone" dataKey="faturamento" stroke="#00D861" strokeWidth={1.5} dot={false} name="faturamento" />
            <Line yAxisId="m" type="monotone" dataKey="investimento" stroke="#E85D22" strokeWidth={1.5} dot={false} name="investimento" />
            <Line yAxisId="r" type="monotone" dataKey="roas" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="roas" />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex gap-4">
          {[{ color: "#00D861", label: "Faturamento" }, { color: "#E85D22", label: "Investimento" }, { color: "rgba(255,255,255,0.2)", label: "ROAS" }].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-white/25">
              <span className="h-px w-3" style={{ backgroundColor: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* UTM Tables */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Análise por UTM</h2>
          <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
            {utmDimensions.map((dim) => (
              <button key={dim.key} onClick={() => setActiveTab(dim.key)}
                className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                  activeTab === dim.key ? "bg-white text-[#08080A]" : "text-white/30 hover:text-white/60")}>
                {dim.label}
              </button>
            ))}
          </div>
        </div>
        {utmTables[activeTab] && <UTMTable rows={utmTables[activeTab]!} />}
      </div>
    </div>
  );
}