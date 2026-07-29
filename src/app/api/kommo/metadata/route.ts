/**
 * Growfy LaunchOS — Kommo Metadata Sync
 * POST /api/kommo/metadata   body: { workspaceId }
 *
 * Busca loss_reasons + users da conta Kommo e salva em
 * workspaces/{id}.kommoLossReasons / kommoUsers pra usar como tabela de
 * tradução na UI (motivo de perda, leads por responsável).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/api-auth";
import { fetchKommoLossReasons, fetchKommoUsers } from "@/lib/kommo-api-service";

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = (await req.json()) as { workspaceId: string };
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    const auth = await requireAuth(req, { workspaceId });
    if (!auth.ok) return auth.response;

    const db = getAdminDb();
    const wsRef = db.collection("workspaces").doc(workspaceId);
    const wsDoc = await wsRef.get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
    }

    const wsData = wsDoc.data() as Record<string, unknown>;
    const subdomain = wsData.kommoSubdomain as string | undefined;
    const accessToken = wsData.kommoAccessToken as string | undefined;

    if (!subdomain || !accessToken) {
      return NextResponse.json(
        { error: "Configure subdomain e accessToken do Kommo antes de sincronizar" },
        { status: 400 }
      );
    }

    const creds = { subdomain, accessToken };

    const [lossReasons, users] = await Promise.all([
      fetchKommoLossReasons(creds),
      fetchKommoUsers(creds),
    ]);

    const kommoLossReasons = lossReasons.map((r) => ({ id: String(r.id), name: r.name }));
    const kommoUsers = users.map((u) => ({ id: String(u.id), name: u.name, email: u.email }));

    await wsRef.update({
      kommoLossReasons,
      kommoUsers,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      lossReasonsCount: kommoLossReasons.length,
      usersCount: kommoUsers.length,
    });
  } catch (error) {
    console.error("❌ [Kommo Metadata]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
