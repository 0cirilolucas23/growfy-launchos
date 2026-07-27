/**
 * Growfy LaunchOS — Kommo Webhook
 * URL: POST /api/webhooks/kommo?workspace=WORKSPACE_ID
 *
 * Kommo manda payload magro (só IDs). Aqui a gente:
 * 1. Extrai leadId do payload (form-encoded ou JSON)
 * 2. Enriquece via GET /leads/{id}?with=contacts usando as creds do workspace
 * 3. Resolve stageName a partir de workspace.kommoStages (sem chamar API de novo)
 * 4. Normaliza + grava via processWebhookEvent
 */
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeKommo,
  processWebhookEvent,
  verifyKommoSignature,
  type KommoStageRef,
} from "@/lib/webhook-service";
import { fetchKommoLead } from "@/lib/kommo-api-service";
import { getAdminDb } from "@/lib/firebase-admin";

export const maxDuration = 60;

// Kommo classic webhook: leads[status][0][id]=123 → array de eventos
// Kommo digital pipeline: JSON com { leads: { status: [...] } }
function extractLeadIds(body: string, contentType: string): string[] {
  const ids = new Set<string>();

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const leads = parsed.leads as Record<string, unknown> | undefined;
      const groups = ["add", "update", "status", "delete"] as const;
      for (const g of groups) {
        const arr = leads?.[g] as Array<{ id?: string | number }> | undefined;
        arr?.forEach((it) => it?.id && ids.add(String(it.id)));
      }
    } catch {
      // ignora
    }
    return Array.from(ids);
  }

  // form-encoded: leads[status][0][id]=123&leads[status][0][status_id]=456
  const params = new URLSearchParams(body);
  params.forEach((value, key) => {
    const match = key.match(/^leads\[(?:add|update|status|delete)\]\[\d+\]\[id\]$/);
    if (match && value) ids.add(value);
  });
  return Array.from(ids);
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspace");
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace parameter" }, { status: 400 });
    }

    const body = await req.text();
    const contentType = req.headers.get("content-type") ?? "";

    const secret = process.env.WEBHOOK_SECRET_KOMMO;
    if (secret) {
      const signature = req.headers.get("x-signature") ?? "";
      if (signature && !verifyKommoSignature(body, signature, secret)) {
        console.warn("⚠️ [Kommo] Assinatura inválida");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const leadIds = extractLeadIds(body, contentType);
    if (leadIds.length === 0) {
      console.warn("⚠️ [Kommo] Nenhum leadId no payload");
      return NextResponse.json({ received: true, processed: 0 });
    }

    const db = getAdminDb();
    const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const wsData = wsDoc.data() as Record<string, unknown>;
    const subdomain = wsData.kommoSubdomain as string | undefined;
    const accessToken = wsData.kommoAccessToken as string | undefined;
    const stages = (wsData.kommoStages as Array<{ id: string; name: string; type: KommoStageRef["type"] }> | undefined) ?? [];

    if (!subdomain || !accessToken) {
      return NextResponse.json(
        { error: "Kommo não configurado nesse workspace (falta subdomain ou token)" },
        { status: 400 }
      );
    }

    const stageRefs: KommoStageRef[] = stages.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type ?? "regular",
    }));

    let processed = 0;
    for (const leadId of leadIds) {
      const lead = await fetchKommoLead({ subdomain, accessToken }, leadId);
      if (!lead) continue;

      const event = normalizeKommo(lead, workspaceId, stageRefs);
      await processWebhookEvent(event);
      processed++;
    }

    console.log(`✅ [Kommo] Workspace ${workspaceId}: ${processed}/${leadIds.length} eventos processados`);
    return NextResponse.json({ received: true, processed, total: leadIds.length });
  } catch (error) {
    console.error("❌ [Kommo]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  return NextResponse.json({ status: "ok", platform: "kommo", workspace: workspaceId });
}
