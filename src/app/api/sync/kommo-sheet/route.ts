/**
 * Growfy LaunchOS — Sync Kommo Sheet
 *
 * POST /api/sync/kommo-sheet    body: { workspaceId }
 *   Auth: usuário logado + membro do workspace (via requireAuth)
 *   Lê workspace.kommoSheetId, itera linhas da aba Kommo_Leads e faz upsert em
 *   webhook_events. Skip inteligente: só reprocessa se atualizado_em da linha
 *   for maior que o já salvo (ou se ainda não existe).
 *
 * GET  /api/sync/kommo-sheet?workspaceId=X
 *   Preview: quantas linhas totais/válidas, último sync.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSheetRows } from "@/lib/google-sheets-service";
import { buildHeaderIndex, rowToEvent } from "@/lib/sheet-to-kommo-adapter";
import { processWebhookEvent } from "@/lib/webhook-service";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/api-auth";
import type { KommoStage } from "@/lib/workspace-service";

/**
 * Infere o tipo de uma etapa (won/lost/regular) pelo nome, com regex tolerante
 * a padrões comuns em pt-br. Mesmas regras usadas em inferResultadoFromEtapa
 * no adapter.
 */
function inferStageType(name: string): KommoStage["type"] {
  const v = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (!v) return "regular";
  if (/(ganh|won|convert|conclu[ií]d|fechad[ao].*ganh)/i.test(v)) return "won";
  if (/(perd|lost|descart|cancelad|nao.*converteu)/i.test(v)) return "lost";
  return "regular";
}

/**
 * Deriva a lista de etapas únicas presentes nas linhas processadas.
 * Ordem de sort segue a ordem em que apareceram na planilha.
 */
function deriveStagesFromRows(
  rows: string[][],
  headerIdx: ReturnType<typeof buildHeaderIndex>
): KommoStage[] {
  const seen = new Map<string, KommoStage>();
  let sort = 0;
  const etapaCol = headerIdx.etapa;
  if (etapaCol < 0) return [];
  for (const row of rows) {
    const raw = etapaCol < row.length ? String(row[etapaCol] ?? "").trim() : "";
    if (!raw) continue;
    if (seen.has(raw)) continue;
    seen.set(raw, {
      id: raw,
      name: raw,
      sort: sort++,
      type: inferStageType(raw),
    });
  }
  return Array.from(seen.values());
}

export const maxDuration = 60;

const SHEET_RANGE = "Kommo_Leads!A1:Z2000";

interface SyncOutcome {
  ok: true;
  workspaceId: string;
  totalRows: number;
  processed: number;
  skipped: number;
  errors: number;
  message?: string;
}

/**
 * Sync core. Não faz auth — chamador precisa autorizar.
 * @param force se true, ignora dedup e reprocessa todas as linhas
 */
export async function syncWorkspaceKommoSheet(
  workspaceId: string,
  force = false
): Promise<SyncOutcome> {
  const db = getAdminDb();
  const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
  if (!wsDoc.exists) throw new Error("Workspace não encontrado");

  const wsData = wsDoc.data() as Record<string, unknown>;
  const sheetId = wsData.kommoSheetId as string | undefined;
  if (!sheetId) throw new Error("kommoSheetId não configurado neste workspace");

  const allRows = await getSheetRows({ sheetId, range: SHEET_RANGE });
  if (allRows.length < 2) {
    return {
      ok: true,
      workspaceId,
      totalRows: allRows.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      message: "Planilha vazia ou sem linhas de dados",
    };
  }

  const [headerRow, ...dataRows] = allRows;
  const headerIdx = buildHeaderIndex(headerRow);

  if (headerIdx.lead_id < 0) {
    throw new Error("Coluna lead_id não encontrada no header da planilha");
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of dataRows) {
    try {
      const adapted = rowToEvent(row, headerIdx, workspaceId);
      if (!adapted) {
        skipped++;
        continue;
      }
      if (!force) {
        const existingDoc = await db.collection("webhook_events").doc(adapted.event.id).get();
        if (existingDoc.exists) {
          const existing = existingDoc.data() as Record<string, unknown>;
          // Dedup usa updatedAt (fallback pra timestamp em docs antigos)
          const existingUpd = existing.updatedAt ?? existing.timestamp;
          const existingMs = existingUpd instanceof Date
            ? existingUpd.getTime()
            : existingUpd && typeof (existingUpd as { toMillis?: () => number }).toMillis === "function"
              ? (existingUpd as { toMillis: () => number }).toMillis()
              : 0;
          const rowMs = adapted.updatedAtIso ? Date.parse(adapted.updatedAtIso) : 0;
          if (rowMs && existingMs && rowMs <= existingMs) {
            skipped++;
            continue;
          }
        }
      }
      await processWebhookEvent(adapted.event);
      processed++;
    } catch (err) {
      console.error("[sync/kommo-sheet] linha com erro:", err);
      errors++;
    }
  }

  // Deriva etapas únicas da própria planilha (não depende de API Kommo)
  const derivedStages = deriveStagesFromRows(dataRows, headerIdx);

  const updatePayload: Record<string, unknown> = {
    kommoSheetLastSyncAt: new Date(),
    kommoSheetLastSyncCount: processed,
  };
  if (derivedStages.length > 0) {
    updatePayload.kommoStages = derivedStages;
  }
  await db.collection("workspaces").doc(workspaceId).update(updatePayload);

  return {
    ok: true,
    workspaceId,
    totalRows: dataRows.length,
    processed,
    skipped,
    errors,
    message: derivedStages.length > 0
      ? `${derivedStages.length} etapas do funil sincronizadas`
      : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { workspaceId?: string; force?: boolean };
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }
    const auth = await requireAuth(req, { workspaceId });
    if (!auth.ok) return auth.response;
    const result = await syncWorkspaceKommoSheet(workspaceId, Boolean(body.force));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[sync/kommo-sheet POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
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
    const sheetId = wsData.kommoSheetId as string | undefined;
    if (!sheetId) {
      return NextResponse.json({
        configured: false,
        message: "kommoSheetId não configurado neste workspace",
      });
    }

    const allRows = await getSheetRows({ sheetId, range: SHEET_RANGE });
    if (allRows.length < 2) {
      return NextResponse.json({
        configured: true,
        totalRows: 0,
        validRows: 0,
        message: "Planilha vazia ou sem linhas de dados",
      });
    }
    const [headerRow, ...dataRows] = allRows;
    const headerIdx = buildHeaderIndex(headerRow);
    const valid = dataRows.filter((r) => rowToEvent(r, headerIdx, workspaceId) !== null).length;

    return NextResponse.json({
      configured: true,
      totalRows: dataRows.length,
      validRows: valid,
      headerColumns: headerRow,
      lastSyncAt: wsData.kommoSheetLastSyncAt ?? null,
      lastSyncCount: wsData.kommoSheetLastSyncCount ?? null,
    });
  } catch (error) {
    console.error("[sync/kommo-sheet GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
