import { NextRequest, NextResponse } from "next/server";
import { fetchAllKiwifyOrders, normalizeKiwifyOrder } from "@/lib/kiwify-api-service";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = await req.json() as { workspaceId: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    console.log(`🔄 [Kiwify Import] Iniciando importação para workspace: ${workspaceId}`);

    const db = getAdminDb();
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let total = 0;

    const orders = await fetchAllKiwifyOrders((current, t) => {
      total = t;
      console.log(`📦 [Kiwify Import] Buscando: ${current}/${t}`);
    });

    console.log(`📦 [Kiwify Import] Total de pedidos: ${orders.length}`);

    // Batch write to Firestore (max 500 per batch)
    const BATCH_SIZE = 400;
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = orders.slice(i, i + BATCH_SIZE);

      for (const order of chunk) {
        try {
          const normalized = normalizeKiwifyOrder(order, workspaceId);
          const docId = `kiwify_${order.order_id}`;
          const ref = db.collection("webhook_events").doc(docId);

          // Check if already exists
          const existing = await ref.get();
          if (existing.exists) {
            skipped++;
            continue;
          }

          batch.set(ref, normalized);
          imported++;
        } catch (err) {
          console.error(`❌ [Kiwify Import] Erro no pedido ${order.order_id}:`, err);
          errors++;
        }
      }

      await batch.commit();
      console.log(`✅ [Kiwify Import] Lote salvo: ${imported} importados até agora`);
    }

    const result = { imported, skipped, errors, total: orders.length };
    console.log(`✅ [Kiwify Import] Concluído:`, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ [Kiwify Import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace obrigatório" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection("webhook_events")
      .where("workspaceId", "==", workspaceId)
      .where("source", "==", "kiwify")
      .count()
      .get();

    return NextResponse.json({
      status: "ok",
      kiwify_events: snapshot.data().count,
      workspace: workspaceId,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao verificar" }, { status: 500 });
  }
}