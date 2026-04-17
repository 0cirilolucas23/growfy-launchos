/**
 * Growfy LaunchOS — Metrics Service
 * Handles KPI calculations, reverse engineering, and webhook data aggregation.
 */

// ─────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────

export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  refunds: number;
  netRevenue: number;
  growthRate: number; // percentage vs previous period
}

export interface ConversionMetrics {
  leads: number;
  prospects: number;
  customers: number;
  leadToProspectRate: number; // %
  prospectToCustomerRate: number; // %
  overallConversionRate: number; // %
  costPerLead: number;
  costPerAcquisition: number;
}

export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // Click-Through Rate %
  cpc: number; // Cost Per Click
  cpm: number; // Cost Per Mille
  roas: number; // Return On Ad Spend
  frequency: number;
}

export interface WebhookEvent {
  id: string;
  source: WebhookSource;
  type: WebhookEventType;
  amount: number;
  currency: string;
  customerId: string;
  customerEmail: string;
  productId: string;
  productName: string;
  timestamp: Date;
  status: "success" | "pending" | "failed" | "refunded";
  raw?: Record<string, unknown>;
}

export type WebhookSource = "hotmart" | "eduzz" | "kiwify" | "meta_ads" | "manual";

export type WebhookEventType =
  | "purchase"
  | "refund"
  | "subscription_start"
  | "subscription_cancel"
  | "subscription_renewal"
  | "lead"
  | "click";

export interface ReverseEngineeringInputs {
  targetRevenue: number;
  averageTicket: number;
  conversionRate: number; // % (0–100)
  leadCost: number;
  showRate: number; // % (0–100)
  closingRate: number; // % (0–100)
}

export interface ReverseEngineeringResult {
  inputs: ReverseEngineeringInputs;
  salesNeeded: number;
  leadsNeeded: number;
  callsNeeded: number;
  prospectsNeeded: number;
  adBudgetNeeded: number;
  profitEstimate: number;
  roi: number; // %
  breakEvenLeads: number;
  daysToTarget: number; // assuming 30-day month
}

export interface DashboardKPIs {
  revenue: RevenueMetrics;
  conversions: ConversionMetrics;
  ads: AdMetrics;
  topProducts: ProductPerformance[];
  recentEvents: WebhookEvent[];
  chartData: ChartDataPoint[];
}

export interface ProductPerformance {
  id: string;
  name: string;
  source: WebhookSource;
  revenue: number;
  units: number;
  refundRate: number;
  conversionRate: number;
}

export interface ChartDataPoint {
  date: string; // ISO date string
  revenue: number;
  leads: number;
  conversions: number;
  adSpend: number;
}

// ─────────────────────────────────────────────
// Reverse Engineering Calculator
// ─────────────────────────────────────────────

/**
 * Calculates how many leads, calls, and ad budget are needed to hit a revenue target.
 */
export function calculateReverseEngineering(
  inputs: ReverseEngineeringInputs
): ReverseEngineeringResult {
  const {
    targetRevenue,
    averageTicket,
    conversionRate,
    leadCost,
    showRate,
    closingRate,
  } = inputs;

  // Guard against division by zero
  const safeConversion = Math.max(conversionRate, 0.01);
  const safeShowRate = Math.max(showRate, 0.01);
  const safeClosingRate = Math.max(closingRate, 0.01);

  const salesNeeded = Math.ceil(targetRevenue / Math.max(averageTicket, 1));

  // Calls → Sales (closing rate applies to calls that showed up)
  const callsNeeded = Math.ceil(salesNeeded / (safeClosingRate / 100));

  // Prospects → Calls (show rate applies to scheduled calls)
  const prospectsNeeded = Math.ceil(callsNeeded / (safeShowRate / 100));

  // Leads → Prospects (overall conversion rate from lead to prospect)
  const leadsNeeded = Math.ceil(prospectsNeeded / (safeConversion / 100));

  const adBudgetNeeded = leadsNeeded * leadCost;
  const profitEstimate = targetRevenue - adBudgetNeeded;
  const roi = adBudgetNeeded > 0
    ? ((profitEstimate / adBudgetNeeded) * 100)
    : 0;

  const breakEvenLeads = averageTicket > 0
    ? Math.ceil(adBudgetNeeded / averageTicket)
    : 0;

  // Assuming linear distribution over 30 days
  const dailySalesRate = salesNeeded / 30;
  const daysToTarget = dailySalesRate > 0
    ? Math.ceil(salesNeeded / dailySalesRate)
    : 30;

  return {
    inputs,
    salesNeeded,
    leadsNeeded,
    callsNeeded,
    prospectsNeeded,
    adBudgetNeeded,
    profitEstimate,
    roi,
    breakEvenLeads,
    daysToTarget,
  };
}

// ─────────────────────────────────────────────
// Revenue Aggregation
// ─────────────────────────────────────────────

/**
 * Aggregates revenue from a list of webhook events.
 */
export function aggregateRevenue(
  events: WebhookEvent[],
  previousPeriodRevenue = 0
): RevenueMetrics {
  const purchases = events.filter(
  (e) => e.type === "purchase" && (e.status === "success" || e.status === "approved" as unknown)
);
  const refunds = events.filter(
    (e) => e.type === "refund" || e.status === "refunded"
  );
  const subscriptions = events.filter(
  (e) =>
    (e.type === "subscription_start" || e.type === "subscription_renewal") &&
    (e.status === "success" || e.status === "approved" as unknown)
);

  const totalRevenue = purchases.reduce((sum, e) => sum + e.amount, 0);
  const recurringRevenue = subscriptions.reduce((sum, e) => sum + e.amount, 0);
  const oneTimeRevenue = totalRevenue - recurringRevenue;
  const refundAmount = refunds.reduce((sum, e) => sum + e.amount, 0);
  const netRevenue = totalRevenue - refundAmount;

  const growthRate =
    previousPeriodRevenue > 0
      ? ((netRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0;

  return {
    totalRevenue,
    recurringRevenue,
    oneTimeRevenue,
    refunds: refundAmount,
    netRevenue,
    growthRate,
  };
}

// ─────────────────────────────────────────────
// Conversion Metrics
// ─────────────────────────────────────────────

export function calculateConversionMetrics(
  events: WebhookEvent[],
  adMetrics: Pick<AdMetrics, "spend" | "clicks">
): ConversionMetrics {
  const leads = events.filter((e) => e.type === "lead").length;
  const prospects = events.filter(
    (e) => e.type === "purchase" || e.type === "subscription_start"
  ).length;
  const customers = events.filter(
    (e) =>
      (e.type === "purchase" || e.type === "subscription_start") &&
      e.status === "success"
  ).length;

  const safeLeads = Math.max(leads, 1);
  const safeProspects = Math.max(prospects, 1);

  const leadToProspectRate = (prospects / safeLeads) * 100;
  const prospectToCustomerRate = (customers / safeProspects) * 100;
  const overallConversionRate = (customers / safeLeads) * 100;

  const costPerLead =
    adMetrics.spend > 0 && leads > 0 ? adMetrics.spend / leads : 0;
  const costPerAcquisition =
    adMetrics.spend > 0 && customers > 0 ? adMetrics.spend / customers : 0;

  return {
    leads,
    prospects,
    customers,
    leadToProspectRate,
    prospectToCustomerRate,
    overallConversionRate,
    costPerLead,
    costPerAcquisition,
  };
}

// ─────────────────────────────────────────────
// Ad Metrics Calculations
// ─────────────────────────────────────────────

export function calculateAdMetrics(
  spend: number,
  impressions: number,
  clicks: number,
  revenue: number,
  frequency: number
): AdMetrics {
  const safeImpressions = Math.max(impressions, 1);
  const safeClicks = Math.max(clicks, 1);
  const safeSpend = Math.max(spend, 0.01);

  return {
    spend,
    impressions,
    clicks,
    ctr: (clicks / safeImpressions) * 100,
    cpc: spend / safeClicks,
    cpm: (spend / safeImpressions) * 1000,
    roas: revenue / safeSpend,
    frequency,
  };
}

// ─────────────────────────────────────────────
// Chart Data Generation
// ─────────────────────────────────────────────

/**
 * Groups webhook events by day and returns chart-ready data points.
 */
export function buildChartData(
  events: WebhookEvent[],
  days = 30,
  adSpendByDay?: Record<string, number>
): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayEvents = events.filter((e) => {
      const eventDate = new Date(e.timestamp).toISOString().split("T")[0];
      return eventDate === dateStr;
    });

    const revenue = dayEvents
      .filter((e) => e.type === "purchase" && e.status === "success")
      .reduce((sum, e) => sum + e.amount, 0);

    const leads = dayEvents.filter((e) => e.type === "lead").length;

    const conversions = dayEvents.filter(
      (e) =>
        (e.type === "purchase" || e.type === "subscription_start") &&
        e.status === "success"
    ).length;

    points.push({
      date: dateStr,
      revenue,
      leads,
      conversions,
      adSpend: adSpendByDay?.[dateStr] ?? 0,
    });
  }

  return points;
}

// ─────────────────────────────────────────────
// Formatting Utilities
// ─────────────────────────────────────────────

export function formatCurrency(
  value: number,
  currency = "BRL",
  locale = "pt-BR"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

// ─────────────────────────────────────────────
// Mock Data Generator (for development/demo)
// ─────────────────────────────────────────────

export function generateMockEvents(count = 200): WebhookEvent[] {
  const sources: WebhookSource[] = ["hotmart", "eduzz", "kiwify"];
  const eventTypes: WebhookEventType[] = ["purchase", "lead", "refund", "subscription_start"];
  const products = [
    { id: "p1", name: "LaunchOS Academy" },
    { id: "p2", name: "Mentoria VIP 90 dias" },
    { id: "p3", name: "Pack Templates Pro" },
  ];
  const statuses = ["success", "success", "success", "pending", "refunded"] as const;

  const events: WebhookEvent[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 24));

    const product = products[Math.floor(Math.random() * products.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    events.push({
      id: `evt_${Math.random().toString(36).slice(2, 10)}`,
      source,
      type,
      amount: type === "purchase" || type === "subscription_start"
        ? Math.round((Math.random() * 2000 + 97) * 100) / 100
        : 0,
      currency: "BRL",
      customerId: `cust_${Math.random().toString(36).slice(2, 8)}`,
      customerEmail: `user${i}@example.com`,
      productId: product.id,
      productName: product.name,
      timestamp: date,
      status,
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
