"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GitBranch, RefreshCw, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  buildPipelineFunnel,
  formatCurrency,
  formatNumber,
  type WebhookEvent,
} from "@/lib/metrics-service";

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

export default function FunilPage() {
  const { activeWorkspace } = useWorkspace();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const stages = useMemo(
    () => activeWorkspace?.kommoStages ?? [],
    [activeWorkspace?.kommoStages]
  );
  const hasKommoConfigured = Boolean(
    activeWorkspace?.kommoSubdomain && activeWorkspace?.kommoAccessToken
  );
  const hasStages = stages.length > 0;

  async function loadEvents() {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "webhook_events"),
        where("workspaceId", "==", activeWorkspace.id),
        where("source", "==", "kommo")
      );
      const snap = await getDocs(q);
      const rows: WebhookEvent[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          source: "kommo",
          type: (data.type as WebhookEvent["type"]) ?? "lead",
          amount: (data.amount as number) ?? 0,
          currency: (data.currency as string) ?? "BRL",
          customerId: (data.customerId as string) ?? "",
          customerEmail: (data.customerEmail as string) ?? "",
          productId: (data.productId as string) ?? "",
          productName: (data.productName as string) ?? "",
          timestamp: toDate(data.timestamp),
          status: (data.status as WebhookEvent["status"]) ?? "pending",
          raw: {
            stageId: (data.stageId as string) ?? "",
            stageName: (data.stageName as string) ?? "",
          },
        };
      });
      setEvents(rows);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const funnel = useMemo(
    () => buildPipelineFunnel(events, stages),
    [events, stages]
  );

  const maxCount = Math.max(1, ...funnel.map((s) => s.count));
  const totalLeads = funnel.reduce((sum, s) => sum + s.count, 0);
  const wonStage = stages.find((s) => s.type === "won");
  const wonCount = wonStage ? funnel.find((f) => f.stageId === wonStage.id)?.count ?? 0 : 0;
  const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;

  async function handleImport() {
    if (!activeWorkspace) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/import/kommo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setImportResult(`✓ ${data.imported} importados, ${data.skipped} já existiam`);
      await loadEvents();
    } catch (err) {
      setImportResult(`✗ ${err instanceof Error ? err.message : "Erro"}`);
    } finally {
      setIsImporting(false);
    }
  }

  function exportCSV() {
    const rows = [
      ["Etapa", "Leads", "Valor total"],
      ...funnel.map((s) => [s.stageName, String(s.count), s.amount.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funil-${activeWorkspace?.id}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-white/30">Nenhum workspace selecionado</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <GitBranch className="h-4 w-4 text-white/50" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Funil de Leads</h1>
            <p className="text-[11px] text-white/25">
              {activeWorkspace.name} · Kommo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={funnel.length === 0}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.06] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.06] disabled:opacity-40"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
        </div>
      </div>

      {/* Empty states */}
      {!hasKommoConfigured && (
        <div className="rounded-xl border border-[#FAE125]/20 bg-[#FAE125]/5 p-5">
          <p className="text-sm font-semibold text-[#FAE125]">Kommo não configurado</p>
          <p className="text-xs text-white/40 mt-1">
            Vá em Configurações → Kommo, preencha subdomain + access token e clique em &quot;Sincronizar funil&quot;.
          </p>
        </div>
      )}

      {hasKommoConfigured && !hasStages && (
        <div className="rounded-xl border border-[#FAE125]/20 bg-[#FAE125]/5 p-5">
          <p className="text-sm font-semibold text-[#FAE125]">Funil ainda não sincronizado</p>
          <p className="text-xs text-white/40 mt-1">
            As etapas do pipeline não foram carregadas. Vá em Configurações → Kommo → &quot;Sincronizar funil&quot;.
          </p>
        </div>
      )}

      {hasKommoConfigured && hasStages && events.length === 0 && !isLoading && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white/70">Sem leads importados ainda</p>
            <p className="text-xs text-white/30 mt-1">
              Rode o import histórico ou espere webhooks do Kommo chegarem.
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#08080A] hover:bg-white/90 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isImporting ? "Importando..." : "Importar histórico"}
          </button>
        </div>
      )}

      {importResult && (
        <div className={cn(
          "rounded-lg border px-3 py-2 text-xs",
          importResult.startsWith("✓")
            ? "border-[#00D861]/30 bg-[#00D861]/8 text-[#00D861]"
            : "border-[#E85D22]/30 bg-[#E85D22]/8 text-[#E85D22]"
        )}>
          {importResult}
        </div>
      )}

      {/* KPIs */}
      {hasStages && events.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="Total de leads" value={formatNumber(totalLeads)} />
          <KpiCard label="Convertidos" value={formatNumber(wonCount)} />
          <KpiCard
            label="Taxa de conversão"
            value={`${conversionRate.toFixed(1)}%`}
            tone={conversionRate >= 20 ? "good" : conversionRate >= 5 ? "neutral" : "bad"}
          />
        </div>
      )}

      {/* Funnel */}
      {hasStages && funnel.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-white">Pipeline</h2>
            <p className="text-[11px] text-white/25">{events.length} leads no estado atual</p>
          </div>

          {funnel.map((s) => {
            const stageMeta = stages.find((st) => st.id === s.stageId);
            const widthPct = (s.count / maxCount) * 100;
            const tone =
              stageMeta?.type === "won" ? "won"
              : stageMeta?.type === "lost" ? "lost"
              : "regular";

            return (
              <div key={s.stageId} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white/70">{s.stageName}</span>
                    <StageBadge tone={tone} />
                  </div>
                  <div className="flex items-center gap-3 text-white/40">
                    <span>{formatNumber(s.count)} leads</span>
                    {s.amount > 0 && <span>{formatCurrency(s.amount)}</span>}
                  </div>
                </div>
                <div className="h-6 rounded-md bg-white/[0.03] overflow-hidden">
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
  );
}

function KpiCard({ label, value, tone = "neutral" }: {
  label: string;
  value: string;
  tone?: "good" | "neutral" | "bad";
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</p>
      <p className={cn(
        "text-xl font-black mt-1",
        tone === "good" && "text-[#00D861]",
        tone === "bad" && "text-[#E85D22]",
        tone === "neutral" && "text-white"
      )}>{value}</p>
    </div>
  );
}

function StageBadge({ tone }: { tone: "won" | "lost" | "regular" }) {
  if (tone === "regular") return null;
  return (
    <span className={cn(
      "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
      tone === "won" && "bg-[#00D861]/15 text-[#00D861]",
      tone === "lost" && "bg-[#E85D22]/15 text-[#E85D22]"
    )}>
      {tone === "won" ? "Ganho" : "Perdido"}
    </span>
  );
}
