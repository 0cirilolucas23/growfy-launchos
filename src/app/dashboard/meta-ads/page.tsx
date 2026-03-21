"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChannelDashboard } from "@/components/channel-dashboard";
import { generateMockChannelData, ChannelData } from "@/lib/channel-service";
import type { MetaAdsDashboardData } from "@/lib/meta-ads-service";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

function buildChannelDataFromMeta(meta: MetaAdsDashboardData): ChannelData {
  const { metrics, campaigns, chartData } = meta;
  const avgTicket = metrics.purchaseValue / Math.max(metrics.purchases, 1);

  const kpis = {
    investimento: metrics.spend,
    faturamentoTotal: metrics.purchaseValue,
    vendasIngressos: metrics.purchases,
    vendasOrderbump: 0,
    custoporCompra: metrics.spend / Math.max(metrics.purchases, 1),
    lucro: metrics.purchaseValue - metrics.spend,
    progressoInvestimento: { atual: metrics.spend, meta: metrics.spend * 1.5 },
    progressoVendas: { atual: metrics.purchaseValue, meta: metrics.purchaseValue * 1.5 },
    taxaConversaoPV: metrics.ctr,
    sessoes: metrics.clicks,
    initiateCheckouts: Math.round(metrics.clicks * 0.15),
    roas: metrics.roas,
  };

  const chart = chartData.map((d) => ({
    dia: d.date.slice(5).replace("-", "/"),
    faturamento: d.purchases * avgTicket,
    investimento: d.spend,
    roas: d.spend > 0 ? (d.purchases * avgTicket) / d.spend : 0,
  }));

  const rows = campaigns.map((c) => ({
    nome: c.name,
    investimento: c.spend,
    vendas: c.purchases,
    custoPorSessao: c.cpc,
    taxaGancho: c.hookRate,
    ctr: c.ctr,
    custoporCompra: c.spend / Math.max(c.purchases, 1),
    faturamento: c.purchases * avgTicket,
    lucro: (c.purchases * avgTicket) - c.spend,
  }));

  return {
    kpis,
    chartData: chart,
    utmTables: {
      utm_content: rows,
      utm_campaign: rows,
      utm_medium: rows,
    },
  };
}

export default function MetaAdsPage() {
  const [data, setData] = useState<ChannelData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads?days=30");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(buildChannelDataFromMeta(json));
      setIsLive(true);
    } catch (err) {
      console.warn("[Meta Ads] Fallback para mock:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar dados reais");
      setData(generateMockChannelData("meta", 14));
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <RefreshCw className="h-6 w-6 text-white/30 animate-spin mx-auto" />
          <p className="text-sm text-white/30">Carregando dados do Meta Ads...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className={cn(
        "flex items-center gap-2 px-6 py-2 text-xs border-b shrink-0",
        isLive
          ? "bg-[#00D861]/5 border-[#00D861]/15 text-[#00D861]/70"
          : "bg-[#FAE125]/5 border-[#FAE125]/15 text-[#FAE125]/70"
      )}>
        {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        <span>
          {isLive
            ? "Dados reais — API do Meta"
            : `Dados simulados${error ? ` — ${error}` : ""}`}
        </span>
        <button
          onClick={loadData}
          className="ml-auto flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity"
        >
          <RefreshCw className="h-3 w-3" />
          Atualizar
        </button>
      </div>

      <ChannelDashboard
        title="Meta Ads"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
          </svg>
        }
        accent="#5050F2"
        data={data}
        utmDimensions={[
          { key: "utm_content", label: "Criativo" },
          { key: "utm_medium", label: "Público" },
          { key: "utm_campaign", label: "Campanha" },
        ]}
      />
    </div>
  );
}