import { NextRequest, NextResponse } from "next/server";
import {
  normalizeHotmart,
  processWebhookEvent,
  verifyHotmartSignature,
} from "@/lib/webhook-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const secret = process.env.WEBHOOK_SECRET_HOTMART;

    // Verify signature if secret is configured
    if (secret) {
      const signature = req.headers.get("x-hotmart-signature") ?? "";
      if (!verifyHotmartSignature(body, signature, secret)) {
        console.warn("⚠️ [Hotmart] Assinatura inválida");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    console.log(`📦 [Hotmart] Evento recebido: ${payload.event}`);

    const event = normalizeHotmart(payload);
    await processWebhookEvent(event);

    return NextResponse.json({ received: true, id: event.id });
  } catch (error) {
    console.error("❌ [Hotmart] Erro:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Hotmart faz GET para verificar o endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", platform: "hotmart" });
}