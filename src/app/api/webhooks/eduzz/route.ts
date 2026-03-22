import { NextRequest, NextResponse } from "next/server";
import { normalizeEduzz, processWebhookEvent } from "@/lib/webhook-service";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspace");
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace parameter" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      payload = Object.fromEntries(new URLSearchParams(text));
    } else {
      payload = await req.json() as Record<string, unknown>;
    }

    const secret = process.env.WEBHOOK_SECRET_EDUZZ;
    if (secret && payload.token !== secret) {
      console.warn("⚠️ [Eduzz] Token inválido");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log(`📦 [Eduzz] Status: ${payload.trans_status} | Workspace: ${workspaceId}`);

    const event = normalizeEduzz(payload, workspaceId);
    await processWebhookEvent(event);

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("❌ [Eduzz]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  return NextResponse.json({ status: "ok", platform: "eduzz", workspace: workspaceId });
}