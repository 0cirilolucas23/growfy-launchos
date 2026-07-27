/**
 * Growfy LaunchOS — Webhook Service
 * Normaliza eventos de diferentes plataformas e salva no Firestore
 * com suporte a multi-tenant (workspaceId)
 */

import { getAdminDb } from "./firebase-admin";
import { sendWebhookAlert } from "./email-service";
import type { WebhookSource, WebhookEventType } from "./types";

export type { WebhookSource, WebhookEventType };

export interface NormalizedWebhookEvent {
  id: string;
  workspaceId: string;
  source: WebhookSource;
  type: WebhookEventType;
  status: "approved" | "pending" | "refunded" | "cancelled" | "chargeback" | "failed";
  amount: number;
  currency: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  transactionId: string;
  timestamp: Date;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  raw: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Hotmart Normalizer
// ─────────────────────────────────────────────

export function normalizeHotmart(
  payload: Record<string, unknown>,
  workspaceId: string
): NormalizedWebhookEvent {
  const event = (payload.data ?? payload) as Record<string, unknown>;
  const buyer = (event.buyer ?? {}) as Record<string, unknown>;
  const product = (event.product ?? {}) as Record<string, unknown>;
  const purchase = (event.purchase ?? {}) as Record<string, unknown>;
  const tracking = (purchase.tracking ?? {}) as Record<string, unknown>;

  const statusMap: Record<string, NormalizedWebhookEvent["status"]> = {
    APPROVED: "approved", COMPLETE: "approved",
    WAITING_PAYMENT: "pending", REFUNDED: "refunded",
    CANCELLED: "cancelled", CHARGEBACK: "chargeback",
  };

  const typeMap: Record<string, WebhookEventType> = {
    PURCHASE_APPROVED: "purchase", PURCHASE_COMPLETE: "purchase",
    PURCHASE_REFUNDED: "refund", PURCHASE_CANCELLED: "refund",
    PURCHASE_CHARGEBACK: "chargeback",
    SUBSCRIPTION_CANCELLATION: "subscription_cancel",
  };

  const priceObj = (purchase.original_offer_price ?? purchase.price ?? {}) as Record<string, unknown>;

  return {
    id: `hotmart_${purchase.transaction ?? Date.now()}`,
    workspaceId,
    source: "hotmart",
    type: typeMap[payload.event as string] ?? "purchase",
    status: statusMap[purchase.status as string] ?? "pending",
    amount: parseFloat(String(priceObj.value ?? 0)),
    currency: String(priceObj.currency_value ?? "BRL"),
    customerId: String(buyer.ucode ?? buyer.email ?? ""),
    customerName: String(buyer.name ?? ""),
    customerEmail: String(buyer.email ?? ""),
    productId: String(product.id ?? ""),
    productName: String(product.name ?? ""),
    transactionId: String(purchase.transaction ?? ""),
    timestamp: new Date(String(purchase.approved_date ?? Date.now())),
    utmSource: String(tracking.source_sck ?? ""),
    utmContent: String(tracking.source_sck ?? ""),
    raw: payload,
  };
}

// ─────────────────────────────────────────────
// Eduzz Normalizer
// ─────────────────────────────────────────────

export function normalizeEduzz(
  payload: Record<string, unknown>,
  workspaceId: string
): NormalizedWebhookEvent {
  const statusMap: Record<string, NormalizedWebhookEvent["status"]> = {
    "1": "pending", "3": "approved", "4": "cancelled",
    "5": "refunded", "6": "chargeback", "9": "approved",
  };
  const typeMap: Record<string, WebhookEventType> = {
    "3": "purchase", "4": "refund", "5": "refund", "6": "chargeback",
  };
  const statusCode = String(payload.trans_status ?? "1");

  return {
    id: `eduzz_${payload.trans_cod ?? Date.now()}`,
    workspaceId,
    source: "eduzz",
    type: typeMap[statusCode] ?? "purchase",
    status: statusMap[statusCode] ?? "pending",
    amount: parseFloat(String(payload.trans_value ?? "0")),
    currency: "BRL",
    customerId: String(payload.client_document ?? payload.client_email ?? ""),
    customerName: String(payload.client_name ?? ""),
    customerEmail: String(payload.client_email ?? ""),
    customerPhone: String(payload.client_cellphone ?? ""),
    productId: String(payload.content_cod ?? ""),
    productName: String(payload.content_title ?? ""),
    transactionId: String(payload.trans_cod ?? ""),
    timestamp: new Date(String(payload.trans_createdate ?? Date.now())),
    utmSource: String(payload.utm_source ?? ""),
    utmMedium: String(payload.utm_medium ?? ""),
    utmCampaign: String(payload.utm_campaign ?? ""),
    utmContent: String(payload.utm_content ?? ""),
    utmTerm: String(payload.utm_term ?? ""),
    raw: payload,
  };
}

// ─────────────────────────────────────────────
// Kiwify Normalizer
// ─────────────────────────────────────────────

export function normalizeKiwify(
  payload: Record<string, unknown>,
  workspaceId: string
): NormalizedWebhookEvent {
  const statusMap: Record<string, NormalizedWebhookEvent["status"]> = {
    paid: "approved", waiting_payment: "pending",
    refunded: "refunded", chargedback: "chargeback", cancelled: "cancelled",
  };
  const typeMap: Record<string, WebhookEventType> = {
    order_approved: "purchase", order_refunded: "refund",
    subscription_first_charge: "subscription_start",
    subscription_renewed: "subscription_renewal",
    subscription_canceled: "subscription_cancel",
  };

  const Customer = (payload.Customer ?? {}) as Record<string, unknown>;
  const Product = (payload.Product ?? {}) as Record<string, unknown>;
  const Tracking = (payload.TrackingParameters ?? {}) as Record<string, unknown>;

  return {
    id: `kiwify_${payload.order_id ?? Date.now()}`,
    workspaceId,
    source: "kiwify",
    type: typeMap[payload.webhook_event_type as string] ?? "purchase",
    status: statusMap[payload.order_status as string] ?? "pending",
    amount: parseFloat(String(payload.sale_amount ?? "0")) / 100,
    currency: "BRL",
    customerId: String(Customer.CPF ?? Customer.email ?? ""),
    customerName: String(Customer.full_name ?? ""),
    customerEmail: String(Customer.email ?? ""),
    customerPhone: String(Customer.mobile ?? ""),
    productId: String(Product.product_id ?? ""),
    productName: String(Product.product_name ?? ""),
    transactionId: String(payload.order_id ?? ""),
    timestamp: new Date(String(payload.created_at ?? Date.now())),
    utmSource: String(Tracking.src ?? ""),
    utmMedium: String(Tracking.utm_medium ?? ""),
    utmCampaign: String(Tracking.utm_campaign ?? ""),
    utmContent: String(Tracking.utm_content ?? ""),
    utmTerm: String(Tracking.utm_term ?? ""),
    raw: payload,
  };
}

// ─────────────────────────────────────────────
// Save to Firestore
// ─────────────────────────────────────────────

export async function processWebhookEvent(event: NormalizedWebhookEvent): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection("webhook_events").doc(event.id).set({
      ...event,
      timestamp: event.timestamp,
      createdAt: new Date(),
    });

    console.log(`✅ [Webhook] Saved: ${event.id} (workspace: ${event.workspaceId})`);

    if (
      (event.type === "purchase" || event.type === "refund") &&
      (event.status === "approved" || event.status === "refunded")
    ) {
      await sendWebhookAlert(event);
    }
  } catch (error) {
    console.error(`❌ [Webhook] Error:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Signature Verification
// ─────────────────────────────────────────────

import crypto from "crypto";

export function verifyHotmartSignature(body: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac("sha1", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

export function verifyKiwifySignature(body: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

export function verifyKommoSignature(body: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac("sha1", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

// ─────────────────────────────────────────────
// Kommo Normalizer
// ─────────────────────────────────────────────

export interface KommoStageRef {
  id: string;
  name: string;
  type: "regular" | "won" | "lost";
}

export interface KommoLeadInput {
  id: number | string;
  name?: string;
  price?: number;
  pipeline_id?: number | string;
  status_id?: number | string;
  created_at?: number | string;
  updated_at?: number | string;
  custom_fields_values?: Array<{
    field_id?: number;
    field_name?: string;
    values?: Array<{ value?: unknown }>;
  }> | null;
  _embedded?: {
    contacts?: Array<{
      id?: number;
      name?: string;
      custom_fields_values?: Array<{
        field_code?: string;
        values?: Array<{ value?: string }>;
      }> | null;
    }>;
  };
}

type KommoContact = NonNullable<NonNullable<KommoLeadInput["_embedded"]>["contacts"]>[number];

function pickContactField(contact: KommoContact, code: "EMAIL" | "PHONE"): string {
  const field = contact?.custom_fields_values?.find((f) => f.field_code === code);
  return String(field?.values?.[0]?.value ?? "");
}

function pickCustomFieldNumeric(
  lead: KommoLeadInput,
  fieldName: string
): number {
  const field = lead.custom_fields_values?.find(
    (f) => (f.field_name ?? "").toLowerCase() === fieldName.toLowerCase()
  );
  const raw = field?.values?.[0]?.value;
  const parsed = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normaliza um lead do Kommo (já enriquecido com contacts embutidos) em NormalizedWebhookEvent.
 *
 * ⚠️ TODO (verificação de runtime — spec item 4):
 * Puxar 2-3 leads reais da etapa "Ganho" e checar se `lead.price` vem populado.
 * Se sim, essa é a fonte primária (já é o que a função usa). Se não, o custom field
 * "Venda" (usado como fallback aqui) é a fonte real. Se ambos vazios → o cliente
 * não preenche valor em lugar nenhum ainda (problema de processo do cliente).
 */
export function normalizeKommo(
  lead: KommoLeadInput,
  workspaceId: string,
  stages: KommoStageRef[]
): NormalizedWebhookEvent {
  const stageId = String(lead.status_id ?? "");
  const stage = stages.find((s) => s.id === stageId);

  const type: WebhookEventType =
    stage?.type === "won" || stage?.type === "lost" ? "purchase" : "lead";
  const status: NormalizedWebhookEvent["status"] =
    stage?.type === "won" ? "approved"
    : stage?.type === "lost" ? "failed"
    : "pending";

  const amount = Number(lead.price ?? 0) || pickCustomFieldNumeric(lead, "Venda");

  const contact = lead._embedded?.contacts?.[0];
  const customerName = String(contact?.name ?? lead.name ?? "");
  const customerEmail = contact ? pickContactField(contact, "EMAIL") : "";
  const customerPhone = contact ? pickContactField(contact, "PHONE") : "";
  const customerId = customerEmail || String(contact?.id ?? lead.id);

  const timestamp = lead.updated_at
    ? new Date(Number(lead.updated_at) * 1000)
    : lead.created_at
      ? new Date(Number(lead.created_at) * 1000)
      : new Date();

  return {
    id: `kommo_${lead.id}`,
    workspaceId,
    source: "kommo",
    type,
    status,
    amount,
    currency: "BRL",
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    productId: String(lead.pipeline_id ?? ""),
    productName: stage?.name ?? "",
    transactionId: String(lead.id),
    timestamp,
    pipelineId: String(lead.pipeline_id ?? ""),
    stageId,
    stageName: stage?.name,
    raw: lead as unknown as Record<string, unknown>,
  };
}