/**
 * Growfy LaunchOS — Meta Ads API Route
 * ✅ Multi-workspace: lê metaAccessToken e metaAdAccountId do workspace no Firestore
 */
import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fetchMetaAdsDashboard } from "@/lib/meta-ads-service";
import type { MetaDateRange, MetaCredentials } from "@/lib/meta-ads-service";

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const since = searchParams.get("since");
    const until = searchParams.get("until");
    const workspaceId = searchParams.get("workspaceId");

    if (!since || !until) {
      return NextResponse.json({ error: "since e until são obrigatórios" }, { status: 400 });
    }

    const dateRange: MetaDateRange = { since, until };

    // ✅ FIX: busca credenciais do workspace específico
    let credentials: MetaCredentials | undefined;

    if (workspaceId) {
      try {
        const db = getAdminDb();
        const workspaceDoc = await db.collection("workspaces").doc(workspaceId).get();

        if (workspaceDoc.exists) {
          const data = workspaceDoc.data() as Record<string, unknown>;
          const wsToken = data?.metaAccessToken as string | undefined;
          const wsAccountId = data?.metaAdAccountId as string | undefined;

          if (wsToken && wsAccountId) {
            // Workspace tem credenciais próprias — usa elas
            credentials = { token: wsToken, accountId: wsAccountId };
          }
          // Se não tem credenciais, vai cair no fallback das env vars (padrão do Meta)
        }
      } catch (err) {
        console.warn("[meta-ads route] Erro ao buscar workspace:", err);
        // Continua com env vars como fallback
      }
    }

    const data = await fetchMetaAdsDashboard(dateRange, credentials);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[meta-ads route]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}