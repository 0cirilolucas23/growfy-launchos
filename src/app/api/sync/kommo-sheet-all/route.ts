/**
 * Growfy LaunchOS — Cron Sync All Kommo Sheets
 *
 * GET /api/sync/kommo-sheet-all
 *   Auth: header `x-cron-secret: $CRON_SECRET` (Vercel Cron manda automaticamente).
 *   Itera todos workspaces com kommoSheetId configurado e chama syncWorkspaceKommoSheet.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { syncWorkspaceKommoSheet } from "../kommo-sheet/route";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      "";
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getAdminDb();
  const snapshot = await db
    .collection("workspaces")
    .where("kommoSheetId", "!=", "")
    .get();

  const results: Array<{
    workspaceId: string;
    ok: boolean;
    processed?: number;
    skipped?: number;
    errors?: number;
    error?: string;
  }> = [];

  for (const doc of snapshot.docs) {
    try {
      const outcome = await syncWorkspaceKommoSheet(doc.id);
      results.push({
        workspaceId: doc.id,
        ok: true,
        processed: outcome.processed,
        skipped: outcome.skipped,
        errors: outcome.errors,
      });
    } catch (err) {
      results.push({
        workspaceId: doc.id,
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    workspaces: results.length,
    results,
  });
}
