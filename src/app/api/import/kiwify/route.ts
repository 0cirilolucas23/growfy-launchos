import { NextRequest, NextResponse } from "next/server";
import { fetchAllKiwifyOrders, normalizeKiwifyOrder, getOrderId } from "@/lib/kiwify-api-service";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const maxDuration = 300;

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    // ✅ settings() apenas na primeira inicialização
    getFirestore().settings({ ignoreUndefinedProperties: true });
  }
  return getFirestore();
}

// ─────────────────────────────────────────────
// GET — verifica quantos eventos já existem
// ─────────────────────────────────────────────
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
      .limit(1)
      .get();

    let total = 0;
    if (!snapshot.empty) {
      const countSnap = await db
        .collection("webhook_events")
        .where("workspaceId", "==", workspaceId)
        .where("source", "==", "kiwify")
        .count()
        .get();
      total = countSnap.data().count;
    }

    return NextResponse.json({ status: "ok", kiwify_events: total, workspace: workspaceId });
  } catch (error) {
    console.warn("[Kiwify Import GET] Erro:", error);
    return NextResponse.json({ status: "ok", kiwify_events: 0, workspace: workspaceId });
  }
}

// ─────────────────────────────────────────────
// POST — importa histórico completo
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = (await req.json()) as { workspaceId: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    console.log(`🔄 [Kiwify Import] Iniciando para workspace: ${workspaceId}`);

    const db = getAdminDb();
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const orders = await fetchAllKiwifyOrders((current, label) => {
      console.log(`📦 [Kiwify Import] ${label} — ${current} coletados`);
    });

    console.log(`📦 [Kiwify Import] Total coletado: ${orders.length}`);

    if (orders.length === 0) {
      return NextResponse.json({
        imported: 0, skipped: 0, errors: 0, total: 0,
        message: "Nenhuma venda encontrada no período.",
      });
    }

    const BATCH_SIZE = 400;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = orders.slice(i, i + BATCH_SIZE);
      let batchHasWrites = false;

      for (const order of chunk) {
        try {
          const orderId = getOrderId(order);

          if (!orderId) {
            console.warn(`⚠️ [Kiwify Import] Pedido sem ID. Campos: ${Object.keys(order).join(", ")}`);
            errors++;
            continue;
          }

          const normalized = normalizeKiwifyOrder(order, workspaceId);
          const docId = `kiwify_${orderId}`;
          const ref = db.collection("webhook_events").doc(docId);

          const existing = await ref.get();
          if (existing.exists) {
            skipped++;
            continue;
          }

          batch.set(ref, normalized);
          imported++;
          batchHasWrites = true;
        } catch (err) {
          console.error(`❌ [Kiwify Import] Erro no pedido ${getOrderId(order)}:`, err);
          errors++;
        }
      }

      if (batchHasWrites) {
        await batch.commit();
        console.log(`✅ [Kiwify Import] Lote salvo: ${imported} importados`);
      }
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