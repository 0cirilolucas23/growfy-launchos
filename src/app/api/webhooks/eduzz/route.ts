import { NextRequest, NextResponse } from "next/server";
import { normalizeEduzz, processWebhookEvent } from "@/lib/webhook-service";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;

    // Eduzz envia form-urlencoded ou JSON dependendo da configuração
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      payload = Object.fromEntries(new URLSearchParams(text));
    } else {
      payload = await req.json();
    }

    // Eduzz usa um token de autenticação simples
    const secret = process.env.WEBHOOK_SECRET_EDUZZ;
    if (secret && payload.token !== secret) {
      console.warn("⚠️ [Eduzz] Token inválido");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log(`📦 [Eduzz] Evento recebido - status: ${payload.trans_status}`);

    const event = normalizeEduzz(payload);
    await processWebhookEvent(event);

    // Eduzz espera status 200 com body específico
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("❌ [Eduzz] Erro:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", platform: "eduzz" });
}