"use client";

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Users, Target, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/metrics-service";
import type { CrmMetricsState } from "@/hooks/use-crm-metrics";
import type { KommoStage } from "@/lib/workspace-service";

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

function Kpi({ label, value, sub, accent, icon, isLoading }: KpiProps) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">{label}</p>
        <div className="flex items-center gap-1">
          {icon}
          <span className="h-1.5 w-1.5 rounded-full mt-0.5" style={{ backgroundColor: accent }} />
        </div>
      </div>
      {isLoading
        ? <div className="h-6 w-20 animate-pulse rounded bg-white/[0.06] mb-1" />
        : <p className="text-xl font-black text-white tracking-tight mb-1">{value}</p>
      }
      {sub && <p className="text-[10px] text-white/25">{sub}</p>}
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
    <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-3 shadow-2xl text-xs">
      <p className="mb-2 text-white/30 font-medium">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-white/40 capitalize">{item.name}:</span>
          <span className="font-bold text-white">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

interface CrmOverviewProps {
  data: CrmMetricsState;
  stages: KommoStage[];
  hasKommoConfigured: boolean;
}

export function CrmOverview({ data, stages, hasKommoConfigured }: CrmOverviewProps) {
  const { totalLeads, wonLeads, funnelConversionRate, cpl, cac, funnel, dailyLeads, meta, lossReasons, salespeople, isLoading } = data;
  const maxLossCount = Math.max(1, ...lossReasons.map((r) => r.count));

  const topCampaigns = [...meta.campaigns]
    .filter((c) => c.spend > 0 && c.leads > 0)
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, 5);

  const chartData = dailyLeads.map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    leads: d.leads,
  }));

  const maxFunnelCount = Math.max(1, ...funnel.map((s) => s.count));

  if (!hasKommoConfigured) {
    return (
      <div className="rounded-xl border border-[#FAE125]/20 bg-[#FAE125]/5 p-5">
        <p className="text-sm font-semibold text-[#FAE125]">Kommo não configurado</p>
        <p className="text-xs text-white/40 mt-1">
          Este workspace está em modo CRM mas ainda não tem Kommo configurado.
          Vá em Configurações → Kommo → preencha subdomain + access token → &quot;Sincronizar funil&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs Meta Ads */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">Meta Ads</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Investimento" value={meta.spend > 0 ? formatCurrency(meta.spend) : "—"} accent="#E85D22" isLoading={isLoading} />
          <Kpi label="Impressões" value={meta.impressions > 0 ? formatNumber(meta.impressions) : "—"} accent="#5050F2" isLoading={isLoading} />
          <Kpi label="Alcance" value={meta.reach > 0 ? formatNumber(meta.reach) : "—"} accent="#5050F2" isLoading={isLoading} />
          <Kpi label="CTR" value={meta.ctr > 0 ? formatPercentage(meta.ctr) : "—"} accent="#FAE125" isLoading={isLoading} />
          <Kpi label="CPC" value={meta.cpc > 0 ? formatCurrency(meta.cpc) : "—"} accent="#FAE125" isLoading={isLoading} />
        </div>
      </div>

      {/* KPIs cruzadas + Kommo */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">Leads & Conversão</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Total de leads"
            value={formatNumber(totalLeads)}
            sub="No período"
            accent="#5050F2"
            icon={<Users className="h-3 w-3 text-white/30" />}
            isLoading={isLoading}
          />
          <Kpi
            label="Ganhos"
            value={formatNumber(wonLeads)}
            sub="Snapshot atual"
            accent="#00D861"
            icon={<TrendingUp className="h-3 w-3 text-[#00D861]/60" />}
            isLoading={isLoading}
          />
          <Kpi
            label="Taxa conversão funil"
            value={funnelConversionRate > 0 ? formatPercentage(funnelConversionRate) : "—"}
            sub="Ganho ÷ total"
            accent="#00D861"
            isLoading={isLoading}
          />
          <Kpi
            label="CPL"
            value={cpl > 0 ? formatCurrency(cpl) : "—"}
            sub="Meta ÷ leads no período"
            accent="#E85D22"
            icon={<TrendingDown className="h-3 w-3 text-white/30" />}
            isLoading={isLoading}
          />
          <Kpi
            label="CAC"
            value={cac > 0 ? formatCurrency(cac) : "—"}
            sub="Meta ÷ ganhos no período"
            accent="#E85D22"
            icon={<Target className="h-3 w-3 text-white/30" />}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Chart + Funil */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Novos leads por dia</h2>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-white/30">
              {formatNumber(totalLeads)} no período
            </span>
          </div>
          {isLoading ? (
            <div className="h-52 animate-pulse rounded-lg bg-white/[0.04]" />
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-xs text-white/20">Sem leads no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5050F2" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#5050F2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="leads" stroke="#5050F2" strokeWidth={1.5} fill="url(#gLeads)" name="leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Funil</h2>
            <span className="text-[10px] text-white/25">snapshot atual</span>
          </div>
          {stages.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/20">
              Etapas não sincronizadas. Vá em Configurações → &quot;Sincronizar funil&quot;.
            </p>
          ) : funnel.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/20">Nenhum lead ainda</p>
          ) : (
            <div className="space-y-2">
              {funnel.map((s) => {
                const stageMeta = stages.find((st) => st.id === s.stageId);
                const widthPct = (s.count / maxFunnelCount) * 100;
                const tone =
                  stageMeta?.type === "won" ? "won"
                  : stageMeta?.type === "lost" ? "lost"
                  : "regular";
                return (
                  <div key={s.stageId} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white/70 truncate max-w-[70%]">{s.stageName}</span>
                      <span className="text-white/50 shrink-0">{formatNumber(s.count)}</span>
                    </div>
                    <div className="h-4 rounded bg-white/[0.03] overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          tone === "won" && "bg-[#00D861]/30",
                          tone === "lost" && "bg-[#E85D22]/25",
                          tone === "regular" && "bg-white/15"
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Motivo de perda + Leads por responsável */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Motivos de perda</h2>
            <span className="text-[10px] text-white/25">snapshot atual</span>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-white/[0.04]" />)}</div>
          ) : lossReasons.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/20">Nenhum lead perdido ainda</p>
          ) : (
            <div className="space-y-2">
              {lossReasons.map((r) => {
                const widthPct = (r.count / maxLossCount) * 100;
                return (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={cn("font-semibold truncate max-w-[70%]", r.id === "__none__" ? "text-white/40 italic" : "text-white/70")}>{r.name}</span>
                      <span className="text-white/50 shrink-0">{formatNumber(r.count)}</span>
                    </div>
                    <div className="h-4 rounded bg-white/[0.03] overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          r.id === "__none__" ? "bg-white/10" : "bg-[#E85D22]/25"
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Leads por responsável</h2>
            <span className="text-[10px] text-white/25">snapshot atual</span>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-white/[0.04]" />)}</div>
          ) : salespeople.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/20">Nenhum responsável atribuído ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/25">Responsável</th>
                    <th className="pb-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/25">Total</th>
                    <th className="pb-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/25">Ganhos</th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-white/25">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {salespeople.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-3 text-white/80 font-semibold truncate max-w-[180px]" title={s.name}>{s.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-white/60">{formatNumber(s.total)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[#00D861]/80">{formatNumber(s.won)}</td>
                      <td className="py-2 text-right tabular-nums font-bold text-white/80">{formatPercentage(s.conversionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top campanhas por CPL */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Top 5 campanhas por CPL</h2>
          <span className="text-[10px] text-white/25">Meta Ads · menor é melhor</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-white/[0.04]" />)}</div>
        ) : topCampaigns.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/20">
            Nenhuma campanha com leads no período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/25">Campanha</th>
                  <th className="pb-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/25">Invest.</th>
                  <th className="pb-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/25">Leads (Meta)</th>
                  <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-white/25">CPL</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-3 text-white/80 font-semibold truncate max-w-[280px]" title={c.name}>{c.name}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-white/60">{formatCurrency(c.spend)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-white/60">{formatNumber(c.leads)}</td>
                    <td className="py-2.5 text-right tabular-nums font-bold text-white/80">{formatCurrency(c.cpl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px] text-white/20">
          CPL = &quot;leads&quot; reportado pelo Meta ÷ investimento. Não bate com &quot;Total de leads&quot; do Kommo (que conta leads que efetivamente entraram no CRM).
        </p>
      </div>
    </div>
  );
}
