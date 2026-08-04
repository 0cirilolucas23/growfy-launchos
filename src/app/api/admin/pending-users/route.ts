/**
 * Growfy LaunchOS — Pending Users Admin API
 *
 * GET  /api/admin/pending-users             → lista pendentes (staffOnly)
 * POST /api/admin/pending-users             → aprova { uid, workspaceId } (staffOnly)
 *   Aprova = adiciona uid em workspaces.members + deleta pending_users/{uid}
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listPendingUsers, approvePendingUser } from "@/lib/admin-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { staffOnly: true });
  if (!auth.ok) return auth.response;
  try {
    const users = await listPendingUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[admin/pending-users GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { staffOnly: true });
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      uid?: string;
      workspaceId?: string;
    };
    if (!body.uid || !body.workspaceId) {
      return NextResponse.json({ error: "uid e workspaceId obrigatórios" }, { status: 400 });
    }
    await approvePendingUser(body.uid, body.workspaceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/pending-users POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
