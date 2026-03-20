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
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseMetricsOptions {
  dateRange?: DateRange;
  useMock?: boolean; // force mock data (dev/demo)
  realtimeEvents?: number; // how many recent events to watch (default: 50)
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DEFAULT_AD_SPEND = 3500; // BRL — replace with real data from Meta Ads webhook
const DATE_RANGE_DAYS: Record<DateRange, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildMetrics(
  events: WebhookEvent[],
  days: number
): Omit<MetricsState, "isLoading" | "isRefreshing" | "error" | "lastUpdated"> {
  const revenue = aggregateRevenue(events);

  const conversions = calculateConversionMetrics(events, {
    spend: DEFAULT_AD_SPEND,
    clicks: Math.round(DEFAULT_AD_SPEND / 2.5), // estimated
  });

  const ads = calculateAdMetrics(
    DEFAULT_AD_SPEND,
    Math.round(DEFAULT_AD_SPEND * 80), // estimated impressions
    Math.round(DEFAULT_AD_SPEND / 2.5),
    revenue.netRevenue,
    2.3 // frequency estimate
  );

  const chartData = buildChartData(events, days);

  // Build top products
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
    } else {
      if (event.status === "success") {
        existing.revenue += event.amount;
        existing.units += 1;
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return { events, revenue, conversions, ads, chartData, topProducts };
}

function firestoreDocToEvent(doc: {
  id: string;
  data: () => Record<string, unknown>;
}): WebhookEvent {
  const data = doc.data();
  return {
    id: doc.id,
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
    status: data.status as WebhookEvent["status"],
    raw: data.raw as Record<string, unknown> | undefined,
  };
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useMetrics(options: UseMetricsOptions = {}): MetricsState & {
  refresh: () => Promise<void>;
  setDateRange: (range: DateRange) => void;
} {
  const {
    dateRange: initialRange = "30d",
    useMock = false,
    realtimeEvents = 50,
  } = options;

  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [state, setState] = useState<MetricsState>({
    events: [],
    revenue: {
      totalRevenue: 0,
      recurringRevenue: 0,
      oneTimeRevenue: 0,
      refunds: 0,
      netRevenue: 0,
      growthRate: 0,
    },
    conversions: {
      leads: 0,
      prospects: 0,
      customers: 0,
      leadToProspectRate: 0,
      prospectToCustomerRate: 0,
      overallConversionRate: 0,
      costPerLead: 0,
      costPerAcquisition: 0,
    },
    ads: {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      roas: 0,
      frequency: 0,
    },
    chartData: [],
    topProducts: [],
    isLoading: true,
    isRefreshing: false,
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
      lastUpdated: new Date(),
      error: null,
    }));
  }, [days]);

  const loadFromFirestore = useCallback(async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffTs = Timestamp.fromDate(cutoff);

      const q = query(
        collection(db, "webhook_events"),
        where("timestamp", ">=", cutoffTs),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      const events = snapshot.docs.map((doc) =>
        firestoreDocToEvent({ id: doc.id, data: () => doc.data() })
      );

      setState((prev) => ({
        ...prev,
        ...buildMetrics(events, days),
        isLoading: false,
        isRefreshing: false,
        lastUpdated: new Date(),
        error: null,
      }));
    } catch (err) {
      console.error("[useMetrics] Firestore error:", err);
      // Fallback to mock data on error
      loadMockData();
    }
  }, [days, loadMockData]);

  const subscribeToRealtimeEvents = useCallback(() => {
    // Clean up previous listener
    unsubscribeRef.current?.();

    const recentQ = query(
      collection(db, "webhook_events"),
      orderBy("timestamp", "desc"),
      limit(realtimeEvents)
    );

    const unsubscribe = onSnapshot(
      recentQ,
      (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) {
          // New real events — trigger a full refresh
          setState((prev) => ({ ...prev, isRefreshing: true }));
          loadFromFirestore();
        }
      },
      (err) => {
        console.warn("[useMetrics] Realtime snapshot error:", err);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, [loadFromFirestore, realtimeEvents]);

  // Initial load
  useEffect(() => {
    setState((prev) => ({ ...prev, isLoading: true }));

    if (useMock) {
      loadMockData();
    } else {
      loadFromFirestore();
      subscribeToRealtimeEvents();
    }

    return () => {
      unsubscribeRef.current?.();
    };
  }, [dateRange, useMock, loadMockData, loadFromFirestore, subscribeToRealtimeEvents]);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));
    if (useMock) {
      loadMockData();
    } else {
      await loadFromFirestore();
    }
  }, [useMock, loadMockData, loadFromFirestore]);

  return {
    ...state,
    refresh,
    setDateRange,
  };
}
