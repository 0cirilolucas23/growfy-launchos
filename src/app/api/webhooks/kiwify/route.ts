import { NextRequest, NextResponse } from "next/server";
import { normalizeKiwify, processWebhookEvent, verifyKiwifySignature } from "@/lib/webhook-service";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspace");
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace parameter" }, { status: 400 });
    }

    const body = await req.text();
    const secret = process.env.WEBHOOK_SECRET_KIWIFY;

    if (secret) {
      const signature = req.headers.get("x-kiwify-signature") ?? "";
      if (signature && !verifyKiwifySignature(body, signature, secret)) {
        console.warn("⚠️ [Kiwify] Assinatura inválida");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    console.log(`📦 [Kiwify] Evento: ${payload.webhook_event_type} | Workspace: ${workspaceId}`);

    const event = normalizeKiwify(payload, workspaceId);
    await processWebhookEvent(event);

    return NextResponse.json({ received: true, id: event.id });
  } catch (error) {
    console.error("❌ [Kiwify]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  return NextResponse.json({ status: "ok", platform: "kiwify", workspace: workspaceId });
}