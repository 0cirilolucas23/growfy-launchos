/**
 * Growfy LaunchOS — Meta Ads Service
 * Integração com a Marketing API do Meta (Facebook Ads)
 * Documentação: https://developers.facebook.com/docs/marketing-api
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
}

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
  hookRate: number; // video 3s / impressions %
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
  chartData: MetaChartPoint[];
  dateRange: { since: string; until: string };
}

// ─────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────

const BASE_URL = "https://graph.facebook.com/v20.0";

async function metaFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 }, // cache 5 minutos
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Meta API Error: ${err.error?.message ?? res.statusText}`
    );
  }

  return res.json();
}

// ─────────────────────────────────────────────
// Date Helpers
// ─────────────────────────────────────────────

function getDateRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
}

// ─────────────────────────────────────────────
// Parse Helpers
// ─────────────────────────────────────────────

function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  const action = actions?.find((a) => a.action_type === type);
  return action ? parseFloat(action.value) : 0;
}

function parseInsightToMetrics(insights: MetaInsight[]): MetaAdsMetrics {
  let spend = 0, impressions = 0, clicks = 0, reach = 0;
  let leads = 0, purchases = 0, purchaseValue = 0;
  let video3s = 0;

  for (const insight of insights) {
    spend += parseFloat(insight.spend ?? "0");
    impressions += parseInt(insight.impressions ?? "0");
    clicks += parseInt(insight.clicks ?? "0");
    reach += parseInt(insight.reach ?? "0");
    leads += getActionValue(insight.actions, "lead");
    purchases += getActionValue(insight.actions, "purchase");
    purchaseValue += getActionValue(insight.actions, "purchase_value");

    // Hook rate: video views 3s / impressions
    const v3s = insight.video_30_sec_watched_actions?.[0]?.value
      ?? insight.video_p25_watched_actions?.[0]?.value
      ?? "0";
    video3s += parseFloat(v3s);
  }

  const safeImpressions = Math.max(impressions, 1);
  const safeSpend = Math.max(spend, 0.01);

  return {
    spend,
    impressions,
    clicks,
    reach,
    ctr: (clicks / safeImpressions) * 100,
    cpc: spend / Math.max(clicks, 1),
    cpm: (spend / safeImpressions) * 1000,
    leads,
    purchases,
    purchaseValue,
    roas: purchaseValue / safeSpend,
    hookRate: (video3s / safeImpressions) * 100,
  };
}

// ─────────────────────────────────────────────
// Main Functions
// ─────────────────────────────────────────────

/**
 * Busca métricas gerais da conta de anúncios
 */
export async function fetchMetaAccountInsights(
  days = 30
): Promise<MetaAdsMetrics> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const { since, until } = getDateRange(days);

  const fields = [
    "spend", "impressions", "clicks", "reach",
    "ctr", "cpc", "cpm",
    "actions", "action_values",
    "video_p25_watched_actions",
    "video_30_sec_watched_actions",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    {
      fields,
      time_range: JSON.stringify({ since, until }),
      level: "account",
    }
  );

  return parseInsightToMetrics(data.data ?? []);
}

/**
 * Busca métricas por campanha
 */
export async function fetchMetaCampaignInsights(
  days = 30
): Promise<MetaCampaignRow[]> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const { since, until } = getDateRange(days);

  const fields = [
    "campaign_id", "campaign_name",
    "spend", "impressions", "clicks", "ctr", "cpc",
    "actions", "action_values",
    "video_p25_watched_actions",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    {
      fields,
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
      limit: "50",
    }
  );

  return (data.data ?? []).map((insight) => {
    const spend = parseFloat(insight.spend ?? "0");
    const impressions = parseInt(insight.impressions ?? "0");
    const clicks = parseInt(insight.clicks ?? "0");
    const leads = getActionValue(insight.actions, "lead");
    const purchases = getActionValue(insight.actions, "purchase");
    const purchaseValue = getActionValue(insight.actions, "purchase_value");
    const video3s = parseFloat(
      insight.video_p25_watched_actions?.[0]?.value ?? "0"
    );

    return {
      id: insight.campaign_id ?? "",
      name: insight.campaign_name ?? "—",
      status: "ACTIVE",
      spend,
      impressions,
      clicks,
      ctr: parseFloat(insight.ctr ?? "0"),
      cpc: parseFloat(insight.cpc ?? "0"),
      leads,
      purchases,
      roas: purchaseValue / Math.max(spend, 0.01),
      hookRate: impressions > 0 ? (video3s / impressions) * 100 : 0,
    };
  });
}

/**
 * Busca dados diários para o gráfico
 */
export async function fetchMetaChartData(
  days = 14
): Promise<MetaChartPoint[]> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const { since, until } = getDateRange(days);

  const fields = [
    "spend", "impressions", "clicks", "actions",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    {
      fields,
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      level: "account",
    }
  );

  return (data.data ?? []).map((insight) => ({
    date: insight.date_start,
    spend: parseFloat(insight.spend ?? "0"),
    impressions: parseInt(insight.impressions ?? "0"),
    clicks: parseInt(insight.clicks ?? "0"),
    leads: getActionValue(insight.actions, "lead"),
    purchases: getActionValue(insight.actions, "purchase"),
  }));
}

/**
 * Busca todos os dados para o dashboard Meta Ads
 */
export async function fetchMetaAdsDashboard(
  days = 30
): Promise<MetaAdsDashboardData> {
  const [metrics, campaigns, chartData] = await Promise.all([
    fetchMetaAccountInsights(days),
    fetchMetaCampaignInsights(days),
    fetchMetaChartData(Math.min(days, 14)),
  ]);

  const { since, until } = getDateRange(days);

  return { metrics, campaigns, chartData, dateRange: { since, until } };
}