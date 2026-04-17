/**
 * Growfy LaunchOS — Kiwify API Service
 */

export interface KiwifyOrder {
  id?: string;
  order_id?: string;
  order_ref?: string;
  order_status?: string;
  status?: string;
  payment_method?: string;
  // Todos os campos monetários possíveis
  sale_amount?: number;
  amount?: number;
  charge_amount?: number;
  price?: number;
  value?: number;
  total?: number;
  total_price?: number;
  created_at?: string;
  updated_at?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    CPF?: string;
  };
  product?: {
    product_id?: string;
    id?: string;
    product_name?: string;
    name?: string;
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
  webhook_event_type?: string;
  [key: string]: unknown;
}

export interface KiwifyOrdersResponse {
  data?: KiwifyOrder[];
  sales?: KiwifyOrder[];
  next_page_token?: string;
  pagination?: {
    next_page_token?: string;
    page_number?: number;
    page_size?: number;
    count?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KiwifyImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

// ─────────────────────────────────────────────
// Helpers para campos com nomes variáveis
// ─────────────────────────────────────────────
export function getOrderId(order: KiwifyOrder): string {
  return (order.order_id ?? order.id ?? "") as string;
}

export function getOrderStatus(order: KiwifyOrder): string {
  return (order.order_status ?? order.status ?? "unknown") as string;
}

// ✅ Tenta todos os campos monetários possíveis
export function getOrderAmount(order: KiwifyOrder): number {
  const raw = (order.net_amount as number | undefined) ?? 0;
  return Number(raw) > 0 ? Number(raw) / 100 : 0;
}

export function getProductId(order: KiwifyOrder): string {
  return (order.product?.product_id ?? order.product?.id ?? "") as string;
}

export function getProductName(order: KiwifyOrder): string {
  return (order.product?.product_name ?? order.product?.name ?? "") as string;
}

function getOrdersArray(res: KiwifyOrdersResponse): KiwifyOrder[] {
  return res.data ?? res.sales ?? [];
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getKiwifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.KIWIFY_CLIENT_ID;
  const clientSecret = process.env.KIWIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("KIWIFY_CLIENT_ID e KIWIFY_CLIENT_SECRET não configurados");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kiwify auth error: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return cachedToken.token;
}

// ─────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────
async function kiwifyFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = await getKiwifyToken();
  const accountId = process.env.KIWIFY_ACCOUNT_ID;
  if (!accountId) throw new Error("KIWIFY_ACCOUNT_ID não configurado");

  const url = new URL(`https://public-api.kiwify.com/v1${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-kiwify-account-id": accountId,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kiwify API error: ${res.status} ${err}`);
  }

  const json = await res.json();

  // ✅ Loga o primeiro pedido REAL (não vazio) para ver campos monetários
  const g = global as Record<string, unknown>;
  if (!g.__kiwifyDebugLogged) {
    const orders = (json as KiwifyOrdersResponse).data ?? (json as KiwifyOrdersResponse).sales ?? [];
    if (orders.length > 0) {
      console.log("🔍 [Kiwify DEBUG] Primeiro pedido real:");
      console.log(JSON.stringify(orders[0], null, 2));
      g.__kiwifyDebugLogged = true;
    }
  }

  return json as T;
}

// ─────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────
function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function buildDateChunks(from: Date, to: Date, chunkDays = 30): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    const chunkEnd = addDays(cursor, chunkDays - 1);
    chunks.push({ start: toISODate(cursor), end: toISODate(chunkEnd > to ? to : chunkEnd) });
    cursor = addDays(cursor, chunkDays);
  }
  return chunks;
}

// ─────────────────────────────────────────────
// Fetch Sales
// ─────────────────────────────────────────────
async function fetchKiwifySalesByDateRange(
  startDate: string,
  endDate: string,
  nextPageToken?: string
): Promise<KiwifyOrdersResponse> {
  const params: Record<string, string> = { start_date: startDate, end_date: endDate };
  if (nextPageToken) params.next_page_token = nextPageToken;
  return kiwifyFetch<KiwifyOrdersResponse>("/sales", params);
}

export async function fetchAllKiwifyOrders(
  onProgress?: (current: number, label: string) => void,
  fromDate?: Date
): Promise<KiwifyOrder[]> {
  const today = new Date();
  const startFrom = fromDate ?? (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return d;
  })();

  const chunks = buildDateChunks(startFrom, today, 30);
  const allOrders: KiwifyOrder[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < chunks.length; i++) {
    const { start, end } = chunks[i];
    onProgress?.(allOrders.length, `Buscando ${start} → ${end} (${i + 1}/${chunks.length})`);
    let nextToken: string | undefined;
    do {
      try {
        const res = await fetchKiwifySalesByDateRange(start, end, nextToken);
        const orders = getOrdersArray(res);

        // DEBUG — ver estrutura completa da paginação
        if (i === chunks.length - 1) { // só no último chunk (mais recente)
          console.log("📄 [Kiwify PAGINATION] keys:", Object.keys(res));
          console.log("📄 [Kiwify PAGINATION] next_page_token:", res.next_page_token);
          console.log("📄 [Kiwify PAGINATION] pagination:", JSON.stringify(res.pagination));
          console.log("📄 [Kiwify PAGINATION] total orders nesse chunk:", orders.length);
        }

        for (const order of orders) {
          const id = getOrderId(order);
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            allOrders.push(order);
          }
        }
        nextToken = res.next_page_token ?? res.pagination?.next_page_token ?? undefined;
      } catch (err) {
        console.warn(`[Kiwify] Erro no chunk ${start}→${end}:`, err);
        nextToken = undefined;
      }
      await new Promise((r) => setTimeout(r, 700));
    } while (nextToken);
  }
  return allOrders;
}

// ─────────────────────────────────────────────
// Normalize
// ─────────────────────────────────────────────
export function normalizeKiwifyOrder(


  order: KiwifyOrder,
  workspaceId: string
): Record<string, unknown> {
  const statusMap: Record<string, string> = {
    paid: "approved", complete: "approved", completed: "approved",
    waiting_payment: "pending",
    refunded: "refunded", chargedback: "chargeback", cancelled: "cancelled",
  };
  const typeMap: Record<string, string> = {
    paid: "purchase", complete: "purchase", completed: "purchase",
    refunded: "refund", chargedback: "chargeback", cancelled: "refund",
  };

  const orderId = getOrderId(order);
  const orderStatus = getOrderStatus(order);
  const rawAmount = getOrderAmount(order);

  // ✅ Loga o valor bruto para diagnóstico
  console.log(`[Kiwify normalize] id=${orderId} rawAmount=${rawAmount} fields=${Object.keys(order).join(",")}`);

  return {
    id: `kiwify_${orderId}`,
    workspaceId,
    source: "kiwify",
    type: typeMap[orderStatus] ?? "purchase",
    status: statusMap[orderStatus] ?? "pending",
    amount: rawAmount,  // salva o valor bruto — corrigimos depois de ver o log
    currency: "BRL",
    customerId: order.customer?.CPF ?? order.customer?.email ?? "",
    customerName: order.customer?.name ?? "",
    customerEmail: order.customer?.email ?? "",
    customerPhone: order.customer?.mobile ?? "",
    productId: getProductId(order),
    productName: getProductName(order),
    transactionId: orderId,
    orderRef: order.order_ref ?? "",
    paymentMethod: order.payment_method ?? "",
    timestamp: order.created_at ? new Date(order.created_at) : new Date(),
    utmSource: order.tracking?.utm_source ?? order.tracking?.src ?? "",
    utmMedium: order.tracking?.utm_medium ?? "",
    utmCampaign: order.tracking?.utm_campaign ?? "",
    utmContent: order.tracking?.utm_content ?? "",
    utmTerm: order.tracking?.utm_term ?? "",
    importedAt: new Date(),
  };
}