/**
 * Growfy LaunchOS — Email Service
 * Envia alertas de webhook via Resend (https://resend.com)
 * 
 * Para usar:
 * 1. Crie uma conta em resend.com (plano gratuito: 3.000 emails/mês)
 * 2. Gere uma API Key
 * 3. Adicione RESEND_API_KEY no .env.local
 * 4. Adicione ALERT_EMAIL_TO no .env.local (seu email)
 */

import type { NormalizedWebhookEvent } from "./webhook-service";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO ?? "";
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM ?? "LaunchOS <noreply@growfy.com.br>";

// ─────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function buildEmailHTML(event: NormalizedWebhookEvent): string {
  const isRefund = event.type === "refund" || event.status === "refunded";
  const accentColor = isRefund ? "#E85D22" : "#00D861";
  const emoji = isRefund ? "⚠️" : "🎉";
  const label = isRefund ? "REEMBOLSO" : "NOVA VENDA";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
    .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #08080A; padding: 24px; text-align: center; }
    .header-logo { color: #fff; font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    .header-sub { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 2px; }
    .badge { display: inline-block; background: ${accentColor}20; color: ${accentColor}; border: 1px solid ${accentColor}40; border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; margin: 20px auto 0; }
    .amount { font-size: 36px; font-weight: 900; color: #08080A; text-align: center; padding: 16px 24px 0; }
    .body { padding: 20px 24px 24px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #999; }
    .value { color: #08080A; font-weight: 600; }
    .footer { background: #fafafa; padding: 16px 24px; text-align: center; font-size: 11px; color: #bbb; border-top: 1px solid #f0f0f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">⚡ Growfy LaunchOS</div>
      <div class="header-sub">Sistema de Gestão de Lançamentos</div>
      <div class="badge">${emoji} ${label}</div>
    </div>
    <div class="amount">${formatCurrency(event.amount)}</div>
    <div class="body">
      <div class="row">
        <span class="label">Plataforma</span>
        <span class="value">${event.source.toUpperCase()}</span>
      </div>
      <div class="row">
        <span class="label">Produto</span>
        <span class="value">${event.productName || "—"}</span>
      </div>
      <div class="row">
        <span class="label">Cliente</span>
        <span class="value">${event.customerName || "—"}</span>
      </div>
      <div class="row">
        <span class="label">E-mail</span>
        <span class="value">${event.customerEmail || "—"}</span>
      </div>
      <div class="row">
        <span class="label">Transação</span>
        <span class="value" style="font-family: monospace; font-size: 11px;">${event.transactionId || "—"}</span>
      </div>
      ${event.utmCampaign ? `
      <div class="row">
        <span class="label">Campanha</span>
        <span class="value">${event.utmCampaign}</span>
      </div>` : ""}
      ${event.utmContent ? `
      <div class="row">
        <span class="label">Criativo</span>
        <span class="value">${event.utmContent}</span>
      </div>` : ""}
      <div class="row">
        <span class="label">Data/Hora</span>
        <span class="value">${event.timestamp.toLocaleString("pt-BR")}</span>
      </div>
    </div>
    <div class="footer">Growfy LaunchOS • growfy.com.br</div>
  </div>
</body>
</html>
  `.trim();
}

// ─────────────────────────────────────────────
// Send Alert
// ─────────────────────────────────────────────

export async function sendWebhookAlert(event: NormalizedWebhookEvent): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("⚠️ [Email] RESEND_API_KEY não configurado — alerta não enviado.");
    return;
  }

  if (!ALERT_EMAIL_TO) {
    console.warn("⚠️ [Email] ALERT_EMAIL_TO não configurado — alerta não enviado.");
    return;
  }

  const isRefund = event.type === "refund" || event.status === "refunded";
  const subject = isRefund
    ? `⚠️ Reembolso de ${formatCurrency(event.amount)} — ${event.source.toUpperCase()}`
    : `🎉 Venda de ${formatCurrency(event.amount)} — ${event.productName}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: ALERT_EMAIL_FROM,
        to: [ALERT_EMAIL_TO],
        subject,
        html: buildEmailHTML(event),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ [Email] Resend error:", err);
    } else {
      console.log(`📧 [Email] Alerta enviado para ${ALERT_EMAIL_TO}`);
    }
  } catch (error) {
    console.error("❌ [Email] Falha ao enviar alerta:", error);
  }
}