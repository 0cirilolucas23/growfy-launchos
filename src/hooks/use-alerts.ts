"use client";

import { useState, useCallback } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/metrics-service";

// ─── Types ───

export type AlertMetric = "roas" | "faturamento" | "investimento" | "vendas";
export type AlertCondition = "below" | "above";

export interface WorkspaceAlert {
  id: string;
  metric: AlertMetric;
  condition: AlertCondition;
  threshold: number;
  email: string;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface AlertMetrics {
  roas: number;
  faturamento: number;
  investimento: number;
  vendas: number;
}

export const METRIC_META: Record<AlertMetric, { label: string; format: (v: number) => string }> = {
  roas:         { label: "ROAS",         format: (v) => `${v.toFixed(2)}x` },
  faturamento:  { label: "Faturamento",  format: (v) => formatCurrency(v)  },
  investimento: { label: "Investimento", format: (v) => formatCurrency(v)  },
  vendas:       { label: "Vendas",       format: (v) => `${Math.round(v)}` },
};

// ─── Hook ───

export function useAlerts(workspaceId: string | null) {
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const alertsRef = useCallback(() => {
    if (!workspaceId) return null;
    return collection(db, "workspaces", workspaceId, "alerts");
  }, [workspaceId]);

  const loadAlerts = useCallback(async () => {
    const ref = alertsRef();
    if (!ref) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(ref);
      const loaded = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          metric: data.metric as AlertMetric,
          condition: data.condition as AlertCondition,
          threshold: data.threshold as number,
          email: data.email as string,
          enabled: data.enabled as boolean,
          lastTriggeredAt: data.lastTriggeredAt instanceof Timestamp
            ? data.lastTriggeredAt.toDate() : null,
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate() : new Date(),
        } satisfies WorkspaceAlert;
      });
      setAlerts(loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } finally {
      setIsLoading(false);
    }
  }, [alertsRef]);

  const createAlert = useCallback(async (
    metric: AlertMetric,
    condition: AlertCondition,
    threshold: number,
    email: string,
  ) => {
    const ref = alertsRef();
    if (!ref) return;
    const docRef = await addDoc(ref, {
      metric, condition, threshold, email,
      enabled: true,
      lastTriggeredAt: null,
      createdAt: Timestamp.now(),
    });
    setAlerts((prev) => [{
      id: docRef.id, metric, condition, threshold, email,
      enabled: true, lastTriggeredAt: null, createdAt: new Date(),
    }, ...prev]);
  }, [alertsRef]);

  const toggleAlert = useCallback(async (alertId: string, enabled: boolean) => {
    if (!workspaceId) return;
    await updateDoc(doc(db, "workspaces", workspaceId, "alerts", alertId), { enabled });
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, enabled } : a));
  }, [workspaceId]);

  const deleteAlert = useCallback(async (alertId: string) => {
    if (!workspaceId) return;
    await deleteDoc(doc(db, "workspaces", workspaceId, "alerts", alertId));
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, [workspaceId]);

  // Avalia alertas contra métricas atuais e dispara e-mails quando necessário
  const checkAlerts = useCallback(async (metrics: AlertMetrics) => {
    if (!workspaceId) return;
    const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h entre disparos do mesmo alerta

    for (const alert of alerts) {
      if (!alert.enabled) continue;

      const value = metrics[alert.metric];
      if (value <= 0) continue; // sem dado real, não dispara

      const triggered = alert.condition === "below"
        ? value < alert.threshold
        : value > alert.threshold;

      if (!triggered) continue;

      const hoursSince = alert.lastTriggeredAt
        ? Date.now() - alert.lastTriggeredAt.getTime()
        : Infinity;

      if (hoursSince < COOLDOWN_MS) continue;

      // Dispara e-mail
      try {
        await fetch("/api/alerts/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metric: METRIC_META[alert.metric].label,
            condition: alert.condition === "below" ? "abaixo de" : "acima de",
            threshold: METRIC_META[alert.metric].format(alert.threshold),
            currentValue: METRIC_META[alert.metric].format(value),
            email: alert.email,
          }),
        });

        // Atualiza lastTriggeredAt no Firestore e no estado local
        const now = new Date();
        await updateDoc(doc(db, "workspaces", workspaceId, "alerts", alert.id), {
          lastTriggeredAt: Timestamp.fromDate(now),
        });
        setAlerts((prev) =>
          prev.map((a) => a.id === alert.id ? { ...a, lastTriggeredAt: now } : a)
        );
      } catch {
        // falha silenciosa — não bloqueia o dashboard
      }
    }
  }, [alerts, workspaceId]);

  return { alerts, isLoading, loadAlerts, createAlert, toggleAlert, deleteAlert, checkAlerts };
}
