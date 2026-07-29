"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/api-client";
import {
  WebhookEvent,
  RevenueMetrics,
  ConversionMetrics,
  AdMetrics,
  ChartDataPoint,
  ProductPerformance,
  aggregateRevenue,
  calculateConversionMetrics,
  calculateAdMetrics,
  buildChartData,
  generateMockEvents,
  WebhookSource,
} from "@/lib/metrics-service";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DateRange = "7d" | "14d" | "30d" | "90d";

export interface MetricChanges {
  faturamento: number;
  investimento: number;
  lucro: number;
  roas: number;
  vendas: number;
  taxaConversao: number;
}

export interface MetricsState {
  events: WebhookEvent[];
  revenue: RevenueMetrics;
  conversions: ConversionMetrics;
  ads: AdMetrics;
  chartData: ChartDataPoint[];
  topProducts: ProductPerformance[];
  changes: MetricChanges;
  metaSessions: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isLive: boolean; // true = Firestore data, false = mock
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseMetricsOptions {
  dateRange?: DateRange;
  sinceDate?: string;
  useMock?: boolean;
  workspaceId?: string | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<DateRange, number> = {
  "7d": 7, "14d": 14, "30d": 30, "90d": 90,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildMetrics(
  events: WebhookEvent[],
  days: number,
  metaSpend = 0,
  metaLeads = 0,
  metaClicks = 0,
  metaImpressions = 0,
  metaCtr = 0,
  metaFrequency = 0,
): Omit<MetricsState, "isLoading" | "isRefreshing" | "isLive" | "error" | "lastUpdated" | "changes" | "metaSessions"> {
  const revenue = aggregateRevenue(events);
  revenue.netRevenue = revenue.netRevenue * 2;
  revenue.totalRevenue = revenue.totalRevenue * 2;

  const conversions = calculateConversionMetrics(events, {
    spend: metaSpend,
    clicks: metaClicks,
  });

  // Sobrescreve leads com dados reais do Meta
  if (metaLeads > 0) conversions.leads = metaLeads;

  // Recalcula custo por lead com dados reais
  conversions.costPerLead = metaLeads > 0 && metaSpend > 0 ? metaSpend / metaLeads : 0;

  // Conversões: só mostra se tiver leads reais
  conversions.overallConversionRate = metaLeads > 0
    ? (conversions.customers / metaLeads) * 100
    : 0;

  const ads = calculateAdMetrics(
    metaSpend,
    metaImpressions,
    metaClicks,
    revenue.netRevenue,
    metaFrequency
  );

  const chartData = buildChartData(events, days);

  const productMap = new Map<string, ProductPerformance>();
  for (const event of events) {
    if (event.type !== "purchase" && event.type !== "subscription_start") continue;
    const existing = productMap.get(event.productId);
    if (!existing) {
      productMap.set(event.productId, {
        id: event.productId,
        name: event.productName,
        source: event.source,
        revenue: event.status === "success" ? event.amount : 0,
        units: event.status === "success" ? 1 : 0,
        refundRate: event.status === "refunded" ? 100 : 0,
        conversionRate: event.status === "success" ? 100 : 0,
      });
    } else if (event.status === "success") {
      existing.revenue += event.amount;
      existing.units += 1;
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return { events, revenue, conversions, ads, chartData, topProducts };
}

function firestoreDocToEvent(id: string, data: Record<string, unknown>): WebhookEvent {
  return {
    id,
    source: (data.source as WebhookSource) ?? "manual",
    type: data.type as WebhookEvent["type"],
    amount: (data.amount as number) ?? 0,
    currency: (data.currency as string) ?? "BRL",
    customerId: (data.customerId as string) ?? "",
    customerEmail: (data.customerEmail as string) ?? "",
    productId: (data.productId as string) ?? "",
    productName: (data.productName as string) ?? "",
    timestamp: data.timestamp instanceof Timestamp
      ? data.timestamp.toDate()
      : new Date(data.timestamp as string),
    status: (data.status === "approved" ? "success" : data.status) as WebhookEvent["status"],
  };
}

const EMPTY_CHANGES: MetricChanges = {
  faturamento: 0, investimento: 0, lucro: 0, roas: 0, vendas: 0, taxaConversao: 0,
};

const EMPTY_METRICS: Omit<MetricsState, "isLoading" | "isRefreshing" | "isLive" | "error" | "lastUpdated"> = {
  events: [],
  revenue: { totalRevenue: 0, recurringRevenue: 0, oneTimeRevenue: 0, refunds: 0, netRevenue: 0, growthRate: 0 },
  conversions: { leads: 0, prospects: 0, customers: 0, leadToProspectRate: 0, prospectToCustomerRate: 0, overallConversionRate: 0, costPerLead: 0, costPerAcquisition: 0 },
  ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, roas: 0, frequency: 0 },
  chartData: [],
  topProducts: [],
  changes: EMPTY_CHANGES,
  metaSessions: 0,
};

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useMetrics(options: UseMetricsOptions = {}): MetricsState & {
  refresh: () => Promise<void>;
  setDateRange: (range: DateRange) => void;
} {
  const { dateRange: initialRange = "30d", useMock = false, workspaceId, sinceDate } = options;
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [state, setState] = useState<MetricsState>({
    ...EMPTY_METRICS,
    isLoading: true,
    isRefreshing: false,
    isLive: false,
    error: null,
    lastUpdated: null,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const days = DATE_RANGE_DAYS[dateRange];

  const loadMockData = useCallback(() => {
    const events = generateMockEvents(250);
    const cutoff = sinceDate
      ? new Date(sinceDate + "T00:00:00")
      : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d; })();
    const filtered = events.filter((e) => new Date(e.timestamp) >= cutoff);
    setState((prev) => ({
      ...prev,
      ...buildMetrics(filtered, days),
      isLoading: false,
      isRefreshing: false,
      isLive: false,
      lastUpdated: new Date(),
      error: null,
    }));
  }, [days, sinceDate]);

  const loadFromFirestore = useCallback(async () => {
    // No workspaceId → use mock
    if (!workspaceId) {
      loadMockData();
      return;
    }

    try {
      const now = new Date();

      const cutoff = sinceDate
        ? new Date(sinceDate + "T00:00:00")
        : (() => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0); return d; })();

      // Período anterior = mesma duração, imediatamente antes do período atual
      const periodMs = now.getTime() - cutoff.getTime();
      const prevCutoff = new Date(cutoff.getTime() - periodMs);

      const q = query(
        collection(db, "webhook_events"),
        where("workspaceId", "==", workspaceId)
      );

      const snapshot = await getDocs(q);

      const allDocsEvents = snapshot.docs.map((doc) =>
        firestoreDocToEvent(doc.id, doc.data() as Record<string, unknown>)
      );

      const events = allDocsEvents.filter((e) => new Date(e.timestamp) >= cutoff);
      const prevEvents = allDocsEvents.filter((e) => {
        const t = new Date(e.timestamp);
        return t >= prevCutoff && t < cutoff;
      });

      // Busca dados do Meta: período atual + anterior em paralelo
      // (sempre busca, mesmo sem eventos de webhook — Meta pode ter gasto sem vendas)
      const until = now.toISOString().split("T")[0];
      const since = sinceDate ?? cutoff.toISOString().split("T")[0];
      const prevSince = prevCutoff.toISOString().split("T")[0];
      const prevUntil = new Date(cutoff.getTime() - 86400000).toISOString().split("T")[0];
      let metaSpend = 0, metaLeads = 0, metaClicks = 0, metaImpressions = 0, metaFrequency = 0, metaLPV = 0;
      let prevSpend = 0, prevLPV = 0;

      try {
        const currentParams = new URLSearchParams({ since, until });
        const prevParams = new URLSearchParams({ since: prevSince, until: prevUntil });
        if (workspaceId) { currentParams.set("workspaceId", workspaceId); prevParams.set("workspaceId", workspaceId); }

        const [currentResult, prevResult] = await Promise.allSettled([
          apiFetch(`/api/meta-ads?${currentParams}`).then((r) => r.json()),
          apiFetch(`/api/meta-ads?${prevParams}`).then((r) => r.json()),
        ]);

        if (currentResult.status === "fulfilled" && currentResult.value?.metrics) {
          const m = currentResult.value.metrics;
          metaSpend = m.spend ?? 0;
          metaLeads = m.leads ?? 0;
          metaClicks = m.clicks ?? 0;
          metaImpressions = m.impressions ?? 0;
          metaFrequency = m.frequency ?? 0;
          metaLPV = m.landingPageViews ?? 0;
        }

        if (prevResult.status === "fulfilled" && prevResult.value?.metrics) {
          const m = prevResult.value.metrics;
          prevSpend = m.spend ?? 0;
          prevLPV = m.landingPageViews ?? 0;
        }
      } catch { /* sem Meta, usa defaults */ }

      // Agrega receita dos dois períodos para comparação
      const currRevAgg = aggregateRevenue(events);
      currRevAgg.totalRevenue *= 2;
      currRevAgg.netRevenue *= 2;

      const prevRevAgg = aggregateRevenue(prevEvents);
      prevRevAgg.totalRevenue *= 2;
      prevRevAgg.netRevenue *= 2;

      const currCustomers = events.filter(
        (e) => (e.type === "purchase" || e.type === "subscription_start") && e.status === "success"
      ).length;
      const prevCustomers = prevEvents.filter(
        (e) => (e.type === "purchase" || e.type === "subscription_start") && e.status === "success"
      ).length;

      const pct = (curr: number, prev: number) =>
        prev > 0 ? ((curr - prev) / prev) * 100 : 0;

      const changes: MetricChanges = {
        faturamento: pct(currRevAgg.totalRevenue, prevRevAgg.totalRevenue),
        investimento: pct(metaSpend, prevSpend),
        lucro: pct(
          currRevAgg.totalRevenue - metaSpend,
          prevRevAgg.totalRevenue - prevSpend
        ),
        roas: pct(
          metaSpend > 0 ? currRevAgg.netRevenue / metaSpend : 0,
          prevSpend > 0 ? prevRevAgg.netRevenue / prevSpend : 0
        ),
        vendas: pct(currCustomers, prevCustomers),
        taxaConversao: pct(
          metaLPV > 0 ? (currCustomers / metaLPV) * 100 : 0,
          prevLPV > 0 ? (prevCustomers / prevLPV) * 100 : 0
        ),
      };

      setState((prev) => ({
        ...prev,
        ...buildMetrics(events, days, metaSpend, metaLeads, metaClicks, metaImpressions, 0, metaFrequency),
        changes,
        metaSessions: metaLPV,
        isLoading: false,
        isRefreshing: false,
        isLive: true,
        lastUpdated: new Date(),
        error: null,
      }));
    } catch (err) {
      console.error("[useMetrics] Firestore error:", err);
      setState((prev) => ({
        ...prev,
        ...EMPTY_METRICS,
        isLoading: false,
        isRefreshing: false,
        isLive: false,
        error: "Erro ao carregar dados",
        lastUpdated: new Date(),
      }));
    }
  }, [days, workspaceId, loadMockData, sinceDate]);

  const subscribeRealtime = useCallback(() => {
    if (!workspaceId) return;
    unsubscribeRef.current?.();

    const recentQ = query(
      collection(db, "webhook_events"),
      where("workspaceId", "==", workspaceId),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(recentQ, (snapshot) => {
      if (!snapshot.metadata.hasPendingWrites && !snapshot.empty) {
        setState((prev) => ({ ...prev, isRefreshing: true }));
        loadFromFirestore();
      }
    }, (err) => {
      console.warn("[useMetrics] Realtime error:", err);
    });

    unsubscribeRef.current = unsubscribe;
  }, [workspaceId, loadFromFirestore]);

  useEffect(() => {
    setState((prev) => ({ ...prev, isLoading: true }));

    if (useMock) {
      loadMockData();
    } else {
      loadFromFirestore();
      subscribeRealtime();

      // Polling a cada 5min como fallback (webhook + Meta Ads)
      const pollInterval = setInterval(() => {
        loadFromFirestore();
      }, 5 * 60 * 1000);

      return () => {
        unsubscribeRef.current?.();
        clearInterval(pollInterval);
      };
    }

    return () => { unsubscribeRef.current?.(); };
  }, [dateRange, workspaceId, useMock, loadMockData, loadFromFirestore, subscribeRealtime]);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));
    if (useMock) loadMockData();
    else await loadFromFirestore();
  }, [useMock, loadMockData, loadFromFirestore]);

  return { ...state, refresh, setDateRange };
}