"use client";

import React, { useState, useEffect } from "react";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, ChevronDown } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useMetrics } from "@/hooks/use-metrics";
import {
  useAlerts, METRIC_META,
  AlertMetric, AlertCondition,
} from "@/hooks/use-alerts";
import { cn } from "@/lib/utils";

// ─── Helpers ───

const METRIC_OPTIONS: { value: AlertMetric; label: string }[] = [
  { value: "roas",         label: "ROAS"         },
  { value: "faturamento",  label: "Faturamento"  },
  { value: "investimento", label: "Investimento" },
  { value: "vendas",       label: "Vendas"       },
];

const CONDITION_OPTIONS: { value: AlertCondition; label: string }[] = [
  { value: "below", label: "Cair abaixo de" },
  { value: "above", label: "Subir acima de"  },
];

function timeAgo(date: Date | null): string {
  if (!date) return "Nunca disparado";
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `Há ${d} dia${d > 1 ? "s" : ""}`;
  if (h > 0) return `Há ${h}h`;
  return "Agora mesmo";
}

// ─── Page ───

export default function NotificacoesPage() {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = activeWorkspace?.id ?? null;

  const { revenue, conversions, ads, isLoading: metricsLoading } = useMetrics({
    dateRange: "30d",
    workspaceId,
  });

  const [metaSpend, setMetaSpend] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    const until = new Date().toISOString().split("T")[0];
    const since = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    fetch(`/api/meta-ads?since=${since}&until=${until}&workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.metrics?.spend) setMetaSpend(d.metrics.spend); })
      .catch(() => {});
  }, [workspaceId]);

  const { alerts, isLoading, loadAlerts, createAlert, toggleAlert, deleteAlert, checkAlerts } =
    useAlerts(workspaceId);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Checa alertas sempre que as métricas forem carregadas
  useEffect(() => {
    if (metricsLoading || !alerts.length) return;
    checkAlerts({
      roas: ads.roas,
      faturamento: revenue.totalRevenue,
      investimento: metaSpend,
      vendas: conversions.customers,
    });
  }, [metricsLoading, ads.roas, revenue.totalRevenue, metaSpend, conversions.customers]);

  // ─── Form state ───
  const [showForm, setShowForm] = useState(false);
  const [formMetric, setFormMetric] = useState<AlertMetric>("roas");
  const [formCondition, setFormCondition] = useState<AlertCondition>("below");
  const [formThreshold, setFormThreshold] = useState("");
  const [formEmail, setFormEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleCreate() {
    const threshold = parseFloat(formThreshold.replace(",", "."));
    if (isNaN(threshold) || threshold <= 0) {
      setFormError("Informe um valor válido.");
      return;
    }
    if (!formEmail.includes("@")) {
      setFormError("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await createAlert(formMetric, formCondition, threshold, formEmail);
      setShowForm(false);
      setFormThreshold("");
    } catch {
      setFormError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // Métricas atuais para exibição de contexto
  const currentMetrics: Record<AlertMetric, number> = {
    roas: ads.roas,
    faturamento: revenue.totalRevenue,
    investimento: metaSpend,
    vendas: conversions.customers,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 space-y-5 p-6 overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Notificações</h1>
            <p className="mt-0.5 text-[11px] text-white/25">
              Receba alertas por e-mail quando métricas atingirem seus limites
            </p>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-[#08080A] hover:bg-white/90 transition-all shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo alerta
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="rounded-xl border border-white/[0.10] bg-white/[0.03] p-5 space-y-4">
            <p className="text-sm font-bold text-white">Configurar novo alerta</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Metric */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30">Métrica</label>
                <div className="relative">
                  <select
                    value={formMetric}
                    onChange={(e) => setFormMetric(e.target.value as AlertMetric)}
                    className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20 pr-8"
                  >
                    {METRIC_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#0D0D10]">{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30">Condição</label>
                <div className="relative">
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as AlertCondition)}
                    className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20 pr-8"
                  >
                    {CONDITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#0D0D10]">{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                </div>
              </div>

              {/* Threshold */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30">
                  Valor limite
                  {!metricsLoading && currentMetrics[formMetric] > 0 && (
                    <span className="ml-1 normal-case font-normal text-white/20">
                      (atual: {METRIC_META[formMetric].format(currentMetrics[formMetric])})
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={formMetric === "roas" ? "ex: 2.5" : "ex: 5000"}
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20 placeholder:text-white/20"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30">E-mail de aviso</label>
                <input
                  type="email"
                  placeholder="voce@email.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20 placeholder:text-white/20"
                />
              </div>
            </div>

            {formError && (
              <p className="text-[11px] text-[#E85D22]">{formError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[11px] font-bold text-[#08080A] hover:bg-white/90 disabled:opacity-50 transition-all"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Salvar alerta
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-white/[0.07] px-4 py-2 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Alert list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] py-16 gap-3">
            <Bell className="h-8 w-8 text-white/10" />
            <p className="text-sm font-semibold text-white/20">Nenhum alerta configurado</p>
            <p className="text-xs text-white/15">Clique em "Novo alerta" para começar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const meta = METRIC_META[alert.metric];
              const currentVal = currentMetrics[alert.metric];
              const isTriggered = currentVal > 0 && (
                alert.condition === "below"
                  ? currentVal < alert.threshold
                  : currentVal > alert.threshold
              );

              return (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-4 transition-all",
                    isTriggered && alert.enabled
                      ? "border-[#E85D22]/30 bg-[#E85D22]/5"
                      : "border-white/[0.07] bg-white/[0.02]",
                    !alert.enabled && "opacity-50"
                  )}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleAlert(alert.id, !alert.enabled)}
                    className="shrink-0 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {alert.enabled
                      ? <ToggleRight className="h-5 w-5 text-[#00D861]" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80">
                      <span className="text-white">{meta.label}</span>
                      {" "}
                      <span className="text-white/40">
                        {alert.condition === "below" ? "cair abaixo de" : "subir acima de"}
                      </span>
                      {" "}
                      <span className="text-white">{meta.format(alert.threshold)}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-white/25">{alert.email}</span>
                      <span className="text-[11px] text-white/15">·</span>
                      <span className="text-[11px] text-white/25">{timeAgo(alert.lastTriggeredAt)}</span>
                      {!metricsLoading && currentVal > 0 && (
                        <>
                          <span className="text-[11px] text-white/15">·</span>
                          <span className="text-[11px] text-white/30">
                            atual: {meta.format(currentVal)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  {isTriggered && alert.enabled && (
                    <span className="shrink-0 rounded-full border border-[#E85D22]/40 bg-[#E85D22]/10 px-2 py-0.5 text-[10px] font-bold text-[#E85D22]">
                      Ativo
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="shrink-0 text-white/20 hover:text-[#E85D22] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Info note */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
          <p className="text-[11px] text-white/20 leading-relaxed">
            <span className="font-semibold text-white/30">Como funciona:</span> os alertas são verificados automaticamente a cada 5 minutos enquanto o dashboard está aberto.
            Cada alerta tem um intervalo mínimo de 4 horas entre disparos para evitar spam.
          </p>
        </div>

      </div>
    </div>
  );
}
