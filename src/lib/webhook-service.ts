/**
 * Growfy LaunchOS — Webhook Service
 * Normaliza eventos de diferentes plataformas para o formato padrão
 * e salva no Firestore.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendWebhookAlert } from "./email-service";

// ─────────────────────────────────────────────
// Firebase Admin (server-side)
// ─────────────────────────────────────────────

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type WebhookSource = "hotmart" | "eduzz" | "kiwify";

export type WebhookEventType =
  | "purchase"
  | "refund"
  | "subscription_start"
  | "subscription_cancel"
  | "subscription_renewal"
  | "abandoned_cart"
  | "chargeback";

export interface NormalizedWebhookEvent {
  id: string;
  source: WebhookSource;
  type: WebhookEventType;
  status: "approved" | "pending" | "refunded" | "cancelled" | "chargeback";
  amount: number;
  currency: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  productId: string;
  productName: string;
  transactionId: string;
  timestamp: Date;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  raw: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Hotmart Normalizer
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeHotmart(payload: any): NormalizedWebhookEvent {
  const event = payload.data || payload;
  const buyer = event.buyer || {};
  const product = event.product || {};
  const purchase = event.purchase || {};
  const tracking = purchase.tracking || {};

  const statusMap: Record<string, NormalizedWebhookEvent["status"]> = {
    APPROVED: "approved",
    COMPLETE: "approved",
    WAITING_PAYMENT: "pending",
    REFUNDED: "refunded",
    CANCELLED: "cancelled",
    CHARGEBACK: "chargeback",
  };

  const typeMap: Record<string, WebhookEventType> = {
    PURCHASE_APPROVED: "purchase",
    PURCHASE_COMPLETE: "purchase",
    PURCHASE_REFUNDED: "refund",
    PURCHASE_CANCELLED: "refund",
    PURCHASE_CHARGEBACK: "chargeback",
    SUBSCRIPTION_CANCELLATION: "subscription_cancel",
  };

  return {
    id: `hotmart_${purchase.transaction || Date.now()}`,
    source: "hotmart",
    type: typeMap[payload.event] ?? "purchase",
    status: statusMap[purchase.status] ?? "pending",
    amount: purchase.original_offer_price?.value ?? purchase.price?.value ?? 0,
    currency: purchase.original_offer_price?.currency_value ?? "BRL",
    customerId: buyer.ucode ?? buyer.email ?? "",
    customerName: buyer.name ?? "",
    customerEmail: buyer.email ?? "",
    productId: String(product.id ?? ""),
    productName: product.name ?? "",
    transactionId: purchase.transaction ?? "",
    timestamp: new Date(purchase.approved_date ?? Date.now()),
    utmSource: tracking.source_sck ?? tracking.external_reference,
    utmMedium: undefined,
    utmCampaign: undefined,
    utmContent: tracking.source_sck,
    utmTerm: undefined,
    raw: payload,
  };
}

// ─────────────────────────────────────────────
// Eduzz Normalizer
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEduzz(payload: any): NormalizedWebhookEvent {
  const statusMap: Record<string, NormalizedWebhookEvent["status"]> = {
    "1": "pending",
    "3": "approved",
    "4": "cancelled",
    "5": "refunded",
    "6": "chargeback",
    "9": "approved", // duplicated/confirmed
  };

  const typeMap: Record<string, WebhookEventType> = {
    "3": "purchase",
    "4": "refund",
    "5": "refund",
    "6": "chargeback",
  };

  const statusCode = String(payload.trans_status ?? "1");

  return {
    id: `eduzz_${payload.trans_cod ?? Date.now()}`,
    source: "eduzz",
    type: typeMap[statusCode] ?? "purchase",
    status: statusMap[statusCode] ?? "pending",
    amount: parseFloat(payload.trans_value ?? "0"),
    currency: "BRL",
    customerId: payload.client_document ?? payload.client_email ?? "",
    customerName: payload.client_name ?? "",
    customerEmail: payload.client_email ?? "",
    productId: String(payload.content_cod ?? ""),
    productName: payload.content_title ?? "",
    transactionId: String(payload.trans_cod ?? ""),
    timestamp: new Date(payload.trans_createdate ?? Date.now()),
    utmSource: payload.utm_source,
    utmMedium: payload.utm_medium,
    utmCampaign: payload.utm_campaign,
    utmContent: payload.utm_content,
    utmTerm: payload.utm_term,
    raw: payload,
  };
}

// ─────────────────────────────────────────────
// Kiwify Normalizer
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeKiwify(payload: any): NormalizedWebhookEvent {
  const statusMap: Record<string, NormalizedWebhookEvent["status"]> = {
    paid: "approved",
    waiting_payment: "pending",
    refunded: "refunded",
    chargedback: "chargeback",
    cancelled: "cancelled",
  };

  const typeMap: Record<string, WebhookEventType> = {
    order_approved: "purchase",
    order_refunded: "refund",
    subscription_first_charge: "subscription_start",
    subscription_renewed: "subscription_renewal",
    subscription_canceled: "subscription_cancel",
  };

  const Customer = payload.Customer || {};
  const Product = payload.Product || {};
  const Tracking = payload.TrackingParameters || {};

  return {
    id: `kiwify_${payload.order_id ?? Date.now()}`,
    source: "kiwify",
    type: typeMap[payload.webhook_event_type] ?? "purchase",
    status: statusMap[payload.order_status] ?? "pending",
    amount: parseFloat(payload.sale_amount ?? "0") / 100,
    currency: "BRL",
    customerId: Customer.CPF ?? Customer.email ?? "",
    customerName: Customer.full_name ?? "",
    customerEmail: Customer.email ?? "",
    productId: Product.product_id ?? "",
    productName: Product.product_name ?? "",
    transactionId: payload.order_id ?? "",
    timestamp: new Date(payload.created_at ?? Date.now()),
    utmSource: Tracking.src,
    utmMedium: Tracking.utm_medium,
    utmCampaign: Tracking.utm_campaign,
    utmContent: Tracking.utm_content,
    utmTerm: Tracking.utm_term,
    raw: payload,
  };
}

// ─────────────────────────────────────────────
// Save to Firestore + Send Alert
// ─────────────────────────────────────────────

export async function processWebhookEvent(event: NormalizedWebhookEvent): Promise<void> {
  try {
    const db = getAdminDb();

    // Save to Firestore
    await db.collection("webhook_events").doc(event.id).set({
      ...event,
      timestamp: event.timestamp,
      createdAt: new Date(),
    });

    console.log(`✅ [Webhook] Saved: ${event.id} (${event.source} - ${event.type})`);

    // Send email alert only for approved purchases and refunds
    if (
      (event.type === "purchase" || event.type === "refund") &&
      (event.status === "approved" || event.status === "refunded")
    ) {
      await sendWebhookAlert(event);
    }
  } catch (error) {
    console.error(`❌ [Webhook] Error processing ${event.id}:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Signature Verification
// ─────────────────────────────────────────────

import crypto from "crypto";

export function verifyHotmartSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha1", secret);
    const expected = hmac.update(body).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export function verifyKiwifySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const expected = hmac.update(body).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}