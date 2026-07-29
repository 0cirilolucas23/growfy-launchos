/**
 * Growfy LaunchOS — Meta Ads API Route
 * ✅ Multi-workspace: lê metaAccessToken e metaAdAccountId do workspace no Firestore.
 * Sem fallback pra env vars — workspace precisa ter creds próprias pra evitar vazamento
 * cross-cliente (uma conta de anúncios de teste como padrão apareceria em qualquer
 * workspace sem creds).
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsDashboard } from "@/lib/meta-ads-service";
import type { MetaDateRange, MetaCredentials } from "@/lib/meta-ads-service";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const since = searchParams.get("since");
    const until = searchParams.get("until");
    const workspaceId = searchParams.get("workspaceId");

    if (!since || !until) {
      return NextResponse.json({ error: "since e until são obrigatórios" }, { status: 400 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    const auth = await requireAuth(req, { workspaceId });
    if (!auth.ok) return auth.response;

    const workspaceDoc = await getAdminDb().collection("workspaces").doc(workspaceId).get();
    if (!workspaceDoc.exists) {
      return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
    }

    const data = workspaceDoc.data() as Record<string, unknown>;
    const wsToken = data?.metaAccessToken as string | undefined;
    const wsAccountId = data?.metaAdAccountId as string | undefined;

    if (!wsToken || !wsAccountId) {
      return NextResponse.json(
        {
          error: "Meta Ads não configurado neste workspace",
          code: "meta_not_configured",
        },
        { status: 400 }
      );
    }

    const credentials: MetaCredentials = { token: wsToken, accountId: wsAccountId };
    const dateRange: MetaDateRange = { since, until };
    const dashboard = await fetchMetaAdsDashboard(dateRange, credentials);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("[meta-ads route]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}