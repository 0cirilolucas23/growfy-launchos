/**
 * Growfy LaunchOS — Shared Event Types
 * Fonte única para WebhookSource e WebhookEventType.
 * Consumido por webhook-service.ts (I/O) e metrics-service.ts (agregação).
 */

export type WebhookSource =
  | "hotmart"
  | "eduzz"
  | "kiwify"
  | "kommo"
  | "meta_ads"
  | "manual";

export type WebhookEventType =
  | "purchase"
  | "refund"
  | "subscription_start"
  | "subscription_cancel"
  | "subscription_renewal"
  | "abandoned_cart"
  | "chargeback"
  | "lead"
  | "click";
