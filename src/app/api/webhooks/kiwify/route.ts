import { NextRequest, NextResponse } from "next/server";
import {
  normalizeKiwify,
  processWebhookEvent,
  verifyKiwifySignature,
} from "@/lib/webhook-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const secret = process.env.WEBHOOK_SECRET_KIWIFY;

    // Kiwify usa HMAC-SHA256
    if (secret) {
      const signature = req.headers.get("x-kiwify-signature") ?? "";
      if (!verifyKiwifySignature(body, signature, secret)) {
        console.warn("⚠️ [Kiwify] Assinatura inválida");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    console.log(`📦 [Kiwify] Evento recebido: ${payload.webhook_event_type}`);

    const event = normalizeKiwify(payload);
    await processWebhookEvent(event);

    return NextResponse.json({ received: true, id: event.id });
  } catch (error) {
    console.error("❌ [Kiwify] Erro:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", platform: "kiwify" });
}