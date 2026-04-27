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

export interface MetricsState {
  events: WebhookEvent[];
  revenue: RevenueMetrics;
  conversions: ConversionMetrics;
  ads: AdMetrics;
  chartData: ChartDataPoint[];
  topProducts: ProductPerformance[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLive: boolean; // true = Firestore data, false = mock
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseMetricsOptions {
  dateRange?: DateRange;
  useMock?: boolean;
  workspaceId?: string | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DEFAULT_AD_SPEND = 3500;
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
): Omit<MetricsState, "isLoading" | "isRefreshing" | "isLive" | "error" | "lastUpdated"> {
  const revenue = aggregateRevenue(events);
  revenue.netRevenue = revenue.netRevenue * 2;
  revenue.totalRevenue = revenue.totalRevenue * 2;

  const spend = metaSpend > 0 ? metaSpend : DEFAULT_AD_SPEND;

  const conversions = calculateConversionMetrics(events, {
    spend,
    clicks: metaClicks > 0 ? metaClicks : Math.round(spend / 2.5),
  });

  // Sobrescreve leads com dados reais do Meta
  if (metaLeads > 0) conversions.leads = metaLeads;

  // Recalcula custo por lead com dados reais
  conversions.costPerLead = metaLeads > 0 ? spend / metaLeads : 0;

  // Conversões: só mostra se tiver leads reais
  conversions.overallConversionRate = metaLeads > 0
    ? (conversions.customers / metaLeads) * 100
    : 0;

  const ads = calculateAdMetrics(
    spend,
    metaImpressions > 0 ? metaImpressions : Math.round(spend * 80),
    metaClicks > 0 ? metaClicks : Math.round(spend / 2.5),
    revenue.netRevenue,
    metaFrequency > 0 ? metaFrequency : 2.3
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

const EMPTY_METRICS: Omit<MetricsState, "isLoading" | "isRefreshing" | "isLive" | "error" | "lastUpdated"> = {
  events: [],
  revenue: { totalRevenue: 0, recurringRevenue: 0, oneTimeRevenue: 0, refunds: 0, netRevenue: 0, growthRate: 0 },
  conversions: { leads: 0, prospects: 0, customers: 0, leadToProspectRate: 0, prospectToCustomerRate: 0, overallConversionRate: 0, costPerLead: 0, costPerAcquisition: 0 },
  ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, roas: 0, frequency: 0 },
  chartData: [],
  topProducts: [],
};

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useMetrics(options: UseMetricsOptions = {}): MetricsState & {
  refresh: () => Promise<void>;
  setDateRange: (range: DateRange) => void;
} {
  const { dateRange: initialRange = "30d", useMock = false, workspaceId } = options;
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
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
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
  }, [days]);

  const loadFromFirestore = useCallback(async () => {
    // No workspaceId → use mock
    if (!workspaceId) {
      loadMockData();
      return;
    }

    try {
      const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - days);
cutoff.setHours(0, 0, 0, 0);
      const q = query(
  collection(db, "webhook_events"),
  where("workspaceId", "==", workspaceId)
);

const snapshot = await getDocs(q);


const events = snapshot.docs
  .map((doc) => firestoreDocToEvent(doc.id, doc.data() as Record<string, unknown>))
  .filter((e) => new Date(e.timestamp) >= cutoff);

      if (events.length === 0) {
        setState((prev) => ({
          ...prev,
          ...EMPTY_METRICS,
          isLoading: false,
          isRefreshing: false,
          isLive: false,
          lastUpdated: new Date(),
          error: null,
        }));
        return;
      }

      // Busca dados reais do Meta
      let metaSpend = 0, metaLeads = 0, metaClicks = 0, metaImpressions = 0, metaFrequency = 0;
      try {
        const until = new Date().toISOString().split("T")[0];
        const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
        const params = new URLSearchParams({ since, until, ...(workspaceId ? { workspaceId } : {}) });
        const metaRes = await fetch(`/api/meta-ads?${params}`);
        const metaData = await metaRes.json();
        if (metaData?.metrics) {
          metaSpend = metaData.metrics.spend ?? 0;
          metaLeads = metaData.metrics.leads ?? 0;
          metaClicks = metaData.metrics.clicks ?? 0;
          metaImpressions = metaData.metrics.impressions ?? 0;
          metaFrequency = metaData.metrics.frequency ?? 0;
        }
      } catch { /* sem Meta, usa defaults */ }

      setState((prev) => ({
        ...prev,
        ...buildMetrics(events, days, metaSpend, metaLeads, metaClicks, metaImpressions, 0, metaFrequency),
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
  }, [days, workspaceId, loadMockData]);

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