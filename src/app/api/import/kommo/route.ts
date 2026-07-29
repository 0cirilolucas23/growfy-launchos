/**
 * Growfy LaunchOS — Kommo Import
 * POST /api/import/kommo   body: { workspaceId }
 * GET  /api/import/kommo?workspace=WSID  → conta eventos já importados
 *
 * Espelha o padrão de import/kiwify: paginação, batch commit, dedup por
 * ID determinístico (kommo_${leadId}).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/api-auth";
import { fetchAllKommoLeads } from "@/lib/kommo-api-service";
import { normalizeKommo, type KommoStageRef } from "@/lib/webhook-service";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace obrigatório" }, { status: 400 });
  }

  const auth = await requireAuth(req, { workspaceId });
  if (!auth.ok) return auth.response;

  try {
    const db = getAdminDb();
    const countSnap = await db
      .collection("webhook_events")
      .where("workspaceId", "==", workspaceId)
      .where("source", "==", "kommo")
      .count()
      .get();
    return NextResponse.json({ status: "ok", kommo_events: countSnap.data().count, workspace: workspaceId });
  } catch (error) {
    console.warn("[Kommo Import GET] Erro:", error);
    return NextResponse.json({ status: "ok", kommo_events: 0, workspace: workspaceId });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = (await req.json()) as { workspaceId: string };
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    const auth = await requireAuth(req, { workspaceId });
    if (!auth.ok) return auth.response;

    const db = getAdminDb();
    const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
    }

    const wsData = wsDoc.data() as Record<string, unknown>;
    const subdomain = wsData.kommoSubdomain as string | undefined;
    const accessToken = wsData.kommoAccessToken as string | undefined;
    const pipelineId = wsData.kommoPipelineId as string | undefined;
    const stages = (wsData.kommoStages as Array<{ id: string; name: string; type: KommoStageRef["type"] }> | undefined) ?? [];

    if (!subdomain || !accessToken) {
      return NextResponse.json(
        { error: "Kommo não configurado nesse workspace" },
        { status: 400 }
      );
    }

    const stageRefs: KommoStageRef[] = stages.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type ?? "regular",
    }));

    console.log(`🔄 [Kommo Import] Iniciando workspace ${workspaceId} (pipeline ${pipelineId ?? "todos"})`);

    const leads = await fetchAllKommoLeads(
      { subdomain, accessToken },
      (current) => console.log(`📦 [Kommo Import] ${current} leads coletados`),
      pipelineId
    );

    console.log(`📦 [Kommo Import] Total coletado: ${leads.length}`);

    if (leads.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0, errors: 0, total: 0 });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH_SIZE = 400;

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = leads.slice(i, i + BATCH_SIZE);
      let hasWrites = false;

      for (const lead of chunk) {
        try {
          const docId = `kommo_${lead.id}`;
          const ref = db.collection("webhook_events").doc(docId);
          const existing = await ref.get();
          if (existing.exists) {
            skipped++;
            continue;
          }

          const normalized = normalizeKommo(lead, workspaceId, stageRefs);
          batch.set(ref, { ...normalized, importedAt: new Date() });
          imported++;
          hasWrites = true;
        } catch (err) {
          console.error(`❌ [Kommo Import] Erro no lead ${lead.id}:`, err);
          errors++;
        }
      }

      if (hasWrites) {
        await batch.commit();
        console.log(`✅ [Kommo Import] Lote salvo: ${imported} importados`);
      }
    }

    const result = { imported, skipped, errors, total: leads.length };
    console.log(`✅ [Kommo Import] Concluído:`, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ [Kommo Import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
