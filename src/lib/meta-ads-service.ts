/**
 * Growfy LaunchOS — Meta Ads Service
 * Integração com a Marketing API do Meta com suporte a filtros, períodos e multi-workspace
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface MetaInsight {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Array<{ action_type: string; value: string }>;
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>;
  video_30_sec_watched_actions?: Array<{ action_type: string; value: string }>;
}

export interface MetaAdsMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  hookRate: number;
}

export interface MetaCampaignRow {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  roas: number;
  hookRate: number;
}

export interface MetaAdRow {
  id: string;
  name: string;
  adsetName: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  roas: number;
  hookRate: number;
}

export interface MetaAdSetRow {
  id: string;
  name: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  roas: number;
}

export interface MetaChartPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
}

export interface MetaAdsDashboardData {
  metrics: MetaAdsMetrics;
  campaigns: MetaCampaignRow[];
  adsets: MetaAdSetRow[];
  ads: MetaAdRow[];
  chartData: MetaChartPoint[];
  dateRange: { since: string; until: string };
}

export interface MetaDateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

// ✅ Credenciais por workspace — evita vazamento entre clientes
export interface MetaCredentials {
  token: string;
  accountId: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const BASE_URL = "https://graph.facebook.com/v20.0";

// ✅ FIX: aceita credenciais explícitas, com fallback para env vars globais
async function metaFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
  credentials?: MetaCredentials
): Promise<T> {
  const token = credentials?.token ?? process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Meta API Error: ${err.error?.message ?? res.statusText}`);
  }
  return res.json();
}

function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  return parseFloat(actions?.find((a) => a.action_type === type)?.value ?? "0");
}

function parseMetrics(insights: MetaInsight[]): MetaAdsMetrics {
  let spend = 0, impressions = 0, clicks = 0, reach = 0;
  let leads = 0, purchases = 0, purchaseValue = 0, video3s = 0;

  for (const i of insights) {
    spend += parseFloat(i.spend ?? "0");
    impressions += parseInt(i.impressions ?? "0");
    clicks += parseInt(i.clicks ?? "0");
    reach += parseInt(i.reach ?? "0");
    leads += getActionValue(i.actions, "lead");
    purchases += getActionValue(i.actions, "purchase");
    purchaseValue += getActionValue(i.actions, "purchase_value");
    video3s += parseFloat(
      i.video_30_sec_watched_actions?.[0]?.value ??
      i.video_p25_watched_actions?.[0]?.value ?? "0"
    );
  }

  const safeImpressions = Math.max(impressions, 1);
  const safeSpend = Math.max(spend, 0.01);

  return {
    spend, impressions, clicks, reach,
    ctr: (clicks / safeImpressions) * 100,
    cpc: spend / Math.max(clicks, 1),
    cpm: (spend / safeImpressions) * 1000,
    leads, purchases, purchaseValue,
    roas: purchaseValue / safeSpend,
    hookRate: (video3s / safeImpressions) * 100,
  };
}

export function getPresetDateRange(preset: string): MetaDateRange {
  const until = new Date();
  const since = new Date();
  switch (preset) {
    case "today": break;
    case "7d": since.setDate(since.getDate() - 7); break;
    case "14d": since.setDate(since.getDate() - 14); break;
    case "30d": since.setDate(since.getDate() - 30); break;
    case "90d": since.setDate(since.getDate() - 90); break;
    default: since.setDate(since.getDate() - 30);
  }
  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
}

// ─────────────────────────────────────────────
// API Functions — todas aceitam credentials opcionais
// ─────────────────────────────────────────────
export async function fetchMetaAccountInsights(
  dateRange: MetaDateRange,
  credentials?: MetaCredentials
): Promise<MetaAdsMetrics> {
  const accountId = credentials?.accountId ?? process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const fields = [
    "spend", "impressions", "clicks", "reach", "ctr", "cpc", "cpm",
    "actions", "action_values",
    "video_p25_watched_actions", "video_30_sec_watched_actions",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    { fields, time_range: JSON.stringify(dateRange), level: "account" },
    credentials
  );
  return parseMetrics(data.data ?? []);
}

export async function fetchMetaCampaigns(
  dateRange: MetaDateRange,
  credentials?: MetaCredentials
): Promise<MetaCampaignRow[]> {
  const accountId = credentials?.accountId ?? process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const fields = [
    "campaign_id", "campaign_name", "spend", "impressions",
    "clicks", "ctr", "cpc", "actions", "action_values",
    "video_p25_watched_actions",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    { fields, time_range: JSON.stringify(dateRange), level: "campaign", limit: "50" },
    credentials
  );

  return (data.data ?? []).map((i) => {
    const spend = parseFloat(i.spend ?? "0");
    const purchaseValue = getActionValue(i.actions, "purchase_value");
    const video3s = parseFloat(i.video_p25_watched_actions?.[0]?.value ?? "0");
    const impressions = parseInt(i.impressions ?? "0");
    return {
      id: i.campaign_id ?? "",
      name: i.campaign_name ?? "—",
      status: "ACTIVE",
      spend,
      impressions,
      clicks: parseInt(i.clicks ?? "0"),
      ctr: parseFloat(i.ctr ?? "0"),
      cpc: parseFloat(i.cpc ?? "0"),
      leads: getActionValue(i.actions, "lead"),
      purchases: getActionValue(i.actions, "purchase"),
      roas: purchaseValue / Math.max(spend, 0.01),
      hookRate: impressions > 0 ? (video3s / impressions) * 100 : 0,
    };
  });
}

export async function fetchMetaAdSets(
  dateRange: MetaDateRange,
  credentials?: MetaCredentials
): Promise<MetaAdSetRow[]> {
  const accountId = credentials?.accountId ?? process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const fields = [
    "adset_id", "adset_name", "campaign_name",
    "spend", "impressions", "clicks", "ctr", "cpc",
    "actions", "action_values",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    { fields, time_range: JSON.stringify(dateRange), level: "adset", limit: "50" },
    credentials
  );

  return (data.data ?? []).map((i) => {
    const spend = parseFloat(i.spend ?? "0");
    const purchaseValue = getActionValue(i.actions, "purchase_value");
    return {
      id: i.adset_id ?? "",
      name: i.adset_name ?? "—",
      campaignName: i.campaign_name ?? "—",
      spend,
      impressions: parseInt(i.impressions ?? "0"),
      clicks: parseInt(i.clicks ?? "0"),
      ctr: parseFloat(i.ctr ?? "0"),
      cpc: parseFloat(i.cpc ?? "0"),
      leads: getActionValue(i.actions, "lead"),
      purchases: getActionValue(i.actions, "purchase"),
      roas: purchaseValue / Math.max(spend, 0.01),
    };
  });
}

export async function fetchMetaAds(
  dateRange: MetaDateRange,
  credentials?: MetaCredentials
): Promise<MetaAdRow[]> {
  const accountId = credentials?.accountId ?? process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const fields = [
    "ad_id", "ad_name", "adset_name", "campaign_name",
    "spend", "impressions", "clicks", "ctr", "cpc",
    "actions", "action_values",
    "video_p25_watched_actions", "video_30_sec_watched_actions",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    { fields, time_range: JSON.stringify(dateRange), level: "ad", limit: "100" },
    credentials
  );

  return (data.data ?? []).map((i) => {
    const spend = parseFloat(i.spend ?? "0");
    const purchaseValue = getActionValue(i.actions, "purchase_value");
    const impressions = parseInt(i.impressions ?? "0");
    const video3s = parseFloat(
      i.video_30_sec_watched_actions?.[0]?.value ??
      i.video_p25_watched_actions?.[0]?.value ?? "0"
    );
    return {
      id: i.ad_id ?? "",
      name: i.ad_name ?? "—",
      adsetName: i.adset_name ?? "—",
      campaignName: i.campaign_name ?? "—",
      spend,
      impressions,
      clicks: parseInt(i.clicks ?? "0"),
      ctr: parseFloat(i.ctr ?? "0"),
      cpc: parseFloat(i.cpc ?? "0"),
      leads: getActionValue(i.actions, "lead"),
      purchases: getActionValue(i.actions, "purchase"),
      roas: purchaseValue / Math.max(spend, 0.01),
      hookRate: impressions > 0 ? (video3s / impressions) * 100 : 0,
    };
  });
}

export async function fetchMetaChartData(
  dateRange: MetaDateRange,
  credentials?: MetaCredentials
): Promise<MetaChartPoint[]> {
  const accountId = credentials?.accountId ?? process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    {
      fields: "spend,impressions,clicks,actions",
      time_range: JSON.stringify(dateRange),
      time_increment: "1",
      level: "account",
    },
    credentials
  );

  return (data.data ?? []).map((i) => ({
    date: i.date_start,
    spend: parseFloat(i.spend ?? "0"),
    impressions: parseInt(i.impressions ?? "0"),
    clicks: parseInt(i.clicks ?? "0"),
    leads: getActionValue(i.actions, "lead"),
    purchases: getActionValue(i.actions, "purchase"),
  }));
}

export async function fetchMetaAdsDashboard(
  dateRange: MetaDateRange,
  credentials?: MetaCredentials
): Promise<MetaAdsDashboardData> {
  const [metrics, campaigns, adsets, ads, chartData] = await Promise.all([
    fetchMetaAccountInsights(dateRange, credentials),
    fetchMetaCampaigns(dateRange, credentials),
    fetchMetaAdSets(dateRange, credentials),
    fetchMetaAds(dateRange, credentials),
    fetchMetaChartData(dateRange, credentials),
  ]);
  return { metrics, campaigns, adsets, ads, chartData, dateRange };
}