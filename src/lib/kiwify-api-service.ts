/**
 * Growfy LaunchOS — Kiwify API Service
 * Importa histórico completo de vendas, assinaturas e clientes
 * Documentação: https://docs.kiwify.com.br
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface KiwifyOrder {
  order_id: string;
  order_ref: string;
  order_status: string;
  payment_method: string;
  sale_amount: number;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string;
    email: string;
    mobile?: string;
    CPF?: string;
  };
  product: {
    product_id: string;
    product_name: string;
  };
  tracking?: {
    src?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
  refund_status?: string;
  webhook_event_type: string;
}

export interface KiwifyOrdersResponse {
  data: KiwifyOrder[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface KiwifyImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getKiwifyToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.KIWIFY_CLIENT_ID;
  const clientSecret = process.env.KIWIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("KIWIFY_CLIENT_ID e KIWIFY_CLIENT_SECRET não configurados");
  }

  const res = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kiwify auth error: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

// ─────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────

async function kiwifyFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getKiwifyToken();
  const accountId = process.env.KIWIFY_ACCOUNT_ID;

  const url = new URL(`https://public-api.kiwify.com/v1${endpoint}`);
  url.searchParams.set("account_id", accountId ?? "");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kiwify API error: ${res.status} ${err}`);
  }

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Fetch Orders
// ─────────────────────────────────────────────

export async function fetchKiwifyOrders(
  page = 1,
  perPage = 100,
  status?: string
): Promise<KiwifyOrdersResponse> {
  const params: Record<string, string> = {
    page: String(page),
    per_page: String(perPage),
  };
  if (status) params.status = status;

  return kiwifyFetch<KiwifyOrdersResponse>("/orders", params);
}

export async function fetchAllKiwifyOrders(
  onProgress?: (current: number, total: number) => void
): Promise<KiwifyOrder[]> {
  const allOrders: KiwifyOrder[] = [];
  
  // Fetch first page to get total
  const firstPage = await fetchKiwifyOrders(1, 100);
  allOrders.push(...firstPage.data);
  
  const totalPages = firstPage.pagination.last_page;
  const total = firstPage.pagination.total;
  
  onProgress?.(allOrders.length, total);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const response = await fetchKiwifyOrders(page, 100);
    allOrders.push(...response.data);
    onProgress?.(allOrders.length, total);
    
    // Rate limit: 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allOrders;
}

// ─────────────────────────────────────────────
// Normalize Kiwify Order → Webhook Event format
// ─────────────────────────────────────────────

export function normalizeKiwifyOrder(
  order: KiwifyOrder,
  workspaceId: string
): Record<string, unknown> {
  const statusMap: Record<string, string> = {
    paid: "approved",
    waiting_payment: "pending",
    refunded: "refunded",
    chargedback: "chargeback",
    cancelled: "cancelled",
  };

  const typeMap: Record<string, string> = {
    paid: "purchase",
    refunded: "refund",
    chargedback: "chargeback",
    cancelled: "refund",
  };

  return {
    id: `kiwify_${order.order_id}`,
    workspaceId,
    source: "kiwify",
    type: typeMap[order.order_status] ?? "purchase",
    status: statusMap[order.order_status] ?? "pending",
    amount: (order.sale_amount ?? 0) / 100,
    currency: "BRL",
    customerId: order.customer?.CPF ?? order.customer?.email ?? "",
    customerName: order.customer?.name ?? "",
    customerEmail: order.customer?.email ?? "",
    customerPhone: order.customer?.mobile ?? "",
    productId: order.product?.product_id ?? "",
    productName: order.product?.product_name ?? "",
    transactionId: order.order_id,
    orderRef: order.order_ref,
    paymentMethod: order.payment_method,
    timestamp: new Date(order.created_at),
    utmSource: order.tracking?.utm_source ?? order.tracking?.src ?? "",
    utmMedium: order.tracking?.utm_medium ?? "",
    utmCampaign: order.tracking?.utm_campaign ?? "",
    utmContent: order.tracking?.utm_content ?? "",
    utmTerm: order.tracking?.utm_term ?? "",
    importedAt: new Date(),
    raw: order,
  };
}