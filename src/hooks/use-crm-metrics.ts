"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/api-client";
import {
  WebhookEvent,
  buildPipelineFunnel,
  type FunnelStage,
  type PipelineStageRef,
} from "@/lib/metrics-service";
import type { KommoLossReasonMeta, KommoUserMeta } from "@/lib/workspace-service";

export type CrmDateRange = "7d" | "14d" | "30d" | "90d";

export interface LossReasonBreakdown {
  id: string;
  name: string;
  count: number;
}

export interface SalespersonBreakdown {
  id: string;
  name: string;
  total: number;
  won: number;
  lost: number;
  conversionRate: number;
}

export interface MetaCampaignSlice {
  id: string;
  name: string;
  spend: number;
  leads: number;
  cpl: number;
}

export interface MetaSlice {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  campaigns: MetaCampaignSlice[];
}

export interface DailyLeadCount {
  date: string;
  leads: number;
}

export interface CrmMetricsState {
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  funnelConversionRate: number;
  cpl: number;
  cac: number;
  funnel: FunnelStage[];
  dailyLeads: DailyLeadCount[];
  meta: MetaSlice;
  lossReasons: LossReasonBreakdown[];
  salespeople: SalespersonBreakdown[];
  isLoading: boolean;
  isLive: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

const DATE_RANGE_DAYS: Record<CrmDateRange, number> = {
  "7d": 7, "14d": 14, "30d": 30, "90d": 90,
};

const EMPTY_META: MetaSlice = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, leads: 0, campaigns: [],
};

const EMPTY_STATE: CrmMetricsState = {
  totalLeads: 0,
  wonLeads: 0,
  lostLeads: 0,
  funnelConversionRate: 0,
  cpl: 0,
  cac: 0,
  funnel: [],
  dailyLeads: [],
  meta: EMPTY_META,
  lossReasons: [],
  salespeople: [],
  isLoading: true,
  isLive: false,
  lastUpdated: null,
  error: null,
};

function firestoreDocToKommoEvent(id: string, data: Record<string, unknown>): WebhookEvent {
  const ts = data.timestamp instanceof Timestamp
    ? data.timestamp.toDate()
    : new Date(data.timestamp as string);
  return {
    id,
    source: "kommo",
    type: (data.type as WebhookEvent["type"]) ?? "lead",
    amount: (data.amount as number) ?? 0,
    currency: (data.currency as string) ?? "BRL",
    customerId: (data.customerId as string) ?? "",
    customerEmail: (data.customerEmail as string) ?? "",
    productId: (data.productId as string) ?? "",
    productName: (data.productName as string) ?? "",
    timestamp: ts,
    status: (data.status as WebhookEvent["status"]) ?? "pending",
    raw: {
      stageId: (data.stageId as string) ?? "",
      stageName: (data.stageName as string) ?? "",
      lossReasonId: (data.lossReasonId as string) ?? "",
      responsibleUserId: (data.responsibleUserId as string) ?? "",
      createdAt: data.createdAt,
    },
  };
}

function buildDailySeries(events: WebhookEvent[], since: Date, days: number): DailyLeadCount[] {
  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
  }
  for (const e of events) {
    const key = new Date(e.timestamp).toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, leads]) => ({ date, leads }));
}

export interface UseCrmMetricsOptions {
  dateRange?: CrmDateRange;
  sinceDate?: string;
  workspaceId: string | null;
  stages: PipelineStageRef[];
  lossReasonsMeta?: KommoLossReasonMeta[];
  usersMeta?: KommoUserMeta[];
}

export function useCrmMetrics(options: UseCrmMetricsOptions): CrmMetricsState & {
  refresh: () => Promise<void>;
} {
  const { dateRange = "30d", sinceDate, workspaceId, stages, lossReasonsMeta = [], usersMeta = [] } = options;
  const [state, setState] = useState<CrmMetricsState>(EMPTY_STATE);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const days = DATE_RANGE_DAYS[dateRange];

  const load = useCallback(async () => {
    if (!workspaceId) {
      setState({ ...EMPTY_STATE, isLoading: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const now = new Date();
      const cutoff = sinceDate
        ? new Date(sinceDate + "T00:00:00")
        : (() => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0); return d; })();

      const q = query(
        collection(db, "webhook_events"),
        where("workspaceId", "==", workspaceId),
        where("source", "==", "kommo")
      );
      const snap = await getDocs(q);
      const allEvents = snap.docs.map((d) => firestoreDocToKommoEvent(d.id, d.data() as Record<string, unknown>));

      // Eventos criados/atualizados no período (filtro por timestamp do evento — que é lead.updated_at)
      const periodEvents = allEvents.filter((e) => new Date(e.timestamp) >= cutoff);

      // Funil usa TODOS os leads (snapshot atual), não só do período
      const funnel = buildPipelineFunnel(allEvents, stages);
      const wonStage = stages.find((s) => s.type === "won");
      const lostStage = stages.find((s) => s.type === "lost");
      const wonLeads = wonStage ? funnel.find((f) => f.stageId === wonStage.id)?.count ?? 0 : 0;
      const lostLeads = lostStage ? funnel.find((f) => f.stageId === lostStage.id)?.count ?? 0 : 0;
      const totalLeadsFunnel = funnel.reduce((s, f) => s + f.count, 0);
      const funnelConversionRate = totalLeadsFunnel > 0 ? (wonLeads / totalLeadsFunnel) * 100 : 0;

      // "Novos leads no período" = eventos com timestamp dentro do range
      const newLeadsInPeriod = periodEvents.length;
      const dailyLeads = buildDailySeries(periodEvents, cutoff, days);

      // Meta: puxa spend + campanhas do período
      const until = now.toISOString().split("T")[0];
      const since = cutoff.toISOString().split("T")[0];
      let meta: MetaSlice = EMPTY_META;
      try {
        const params = new URLSearchParams({ since, until, workspaceId });
        const res = await apiFetch(`/api/meta-ads?${params}`);
        const json = await res.json();
        if (json.metrics) {
          const m = json.metrics;
          const campaigns: MetaCampaignSlice[] = (json.campaigns ?? []).map((c: {
            id: string; name: string; spend: number; leads: number;
          }) => ({
            id: c.id,
            name: c.name,
            spend: c.spend ?? 0,
            leads: c.leads ?? 0,
            cpl: c.leads > 0 ? c.spend / c.leads : 0,
          }));
          meta = {
            spend: m.spend ?? 0,
            impressions: m.impressions ?? 0,
            reach: m.reach ?? 0,
            clicks: m.clicks ?? 0,
            ctr: m.ctr ?? 0,
            cpc: m.cpc ?? 0,
            leads: m.leads ?? 0,
            campaigns,
          };
        }
      } catch { /* sem Meta ok */ }

      const cpl = newLeadsInPeriod > 0 && meta.spend > 0 ? meta.spend / newLeadsInPeriod : 0;
      // CAC calculado com base em leads que viraram Ganho no período (heurística: eventos won com timestamp no range)
      const wonInPeriod = periodEvents.filter((e) => {
        const stage = stages.find((s) => s.id === (e.raw as { stageId?: string })?.stageId);
        return stage?.type === "won";
      }).length;
      const cac = wonInPeriod > 0 && meta.spend > 0 ? meta.spend / wonInPeriod : 0;

      // Loss reasons — usa allEvents (snapshot atual, é o que faz sentido para "por que perdemos")
      const lossReasonMap = new Map<string, number>();
      for (const e of allEvents) {
        const stage = stages.find((s) => s.id === (e.raw as { stageId?: string })?.stageId);
        if (stage?.type !== "lost") continue;
        const id = String((e.raw as { lossReasonId?: string })?.lossReasonId ?? "");
        if (!id) {
          lossReasonMap.set("__none__", (lossReasonMap.get("__none__") ?? 0) + 1);
          continue;
        }
        lossReasonMap.set(id, (lossReasonMap.get(id) ?? 0) + 1);
      }
      const lossReasonNameById = new Map(lossReasonsMeta.map((r) => [r.id, r.name]));
      const lossReasons: LossReasonBreakdown[] = Array.from(lossReasonMap.entries())
        .map(([id, count]) => ({
          id,
          name: id === "__none__" ? "Sem motivo informado" : (lossReasonNameById.get(id) ?? `#${id}`),
          count,
        }))
        .sort((a, b) => b.count - a.count);

      // Salespeople — agrega por responsibleUserId em allEvents (snapshot atual)
      const salespersonAgg = new Map<string, { total: number; won: number; lost: number }>();
      for (const e of allEvents) {
        const uid = String((e.raw as { responsibleUserId?: string })?.responsibleUserId ?? "");
        if (!uid) continue;
        const stage = stages.find((s) => s.id === (e.raw as { stageId?: string })?.stageId);
        const bucket = salespersonAgg.get(uid) ?? { total: 0, won: 0, lost: 0 };
        bucket.total++;
        if (stage?.type === "won") bucket.won++;
        if (stage?.type === "lost") bucket.lost++;
        salespersonAgg.set(uid, bucket);
      }
      const userNameById = new Map(usersMeta.map((u) => [u.id, u.name]));
      const salespeople: SalespersonBreakdown[] = Array.from(salespersonAgg.entries())
        .map(([id, agg]) => ({
          id,
          name: userNameById.get(id) ?? `Usuário #${id}`,
          total: agg.total,
          won: agg.won,
          lost: agg.lost,
          conversionRate: agg.total > 0 ? (agg.won / agg.total) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      setState({
        totalLeads: newLeadsInPeriod,
        wonLeads,
        lostLeads,
        funnelConversionRate,
        cpl,
        cac,
        funnel,
        dailyLeads,
        meta,
        lossReasons,
        salespeople,
        isLoading: false,
        isLive: true,
        lastUpdated: new Date(),
        error: null,
      });
    } catch (err) {
      console.error("[useCrmMetrics]", err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Erro ao carregar",
      }));
    }
  }, [workspaceId, dateRange, sinceDate, days, stages, lossReasonsMeta, usersMeta]);

  useEffect(() => {
    load();
    // realtime: escuta mudanças em webhook_events do workspace/kommo pra recarregar
    if (!workspaceId) return;
    unsubscribeRef.current?.();
    const rtQ = query(
      collection(db, "webhook_events"),
      where("workspaceId", "==", workspaceId),
      where("source", "==", "kommo")
    );
    const unsub = onSnapshot(rtQ, (snap) => {
      if (!snap.metadata.hasPendingWrites && !snap.empty) load();
    }, () => {});
    unsubscribeRef.current = unsub;
    return () => { unsubscribeRef.current?.(); };
  }, [load, workspaceId]);

  return { ...state, refresh: load };
}
