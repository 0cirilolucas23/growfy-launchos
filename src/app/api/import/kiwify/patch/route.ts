/**
 * Growfy LaunchOS — Patch route para corrigir amounts dos eventos Kiwify
 * GET /api/import/kiwify/patch?workspace=WORKSPACE_ID
 * 
 * Após descobrir o campo correto de valor, chame este endpoint
 * para atualizar os documentos já salvos sem reimportar tudo.
 */
import { NextRequest, NextResponse } from "next/server";
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
    getFirestore().settings({ ignoreUndefinedProperties: true });
  }
  return getFirestore();
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, amountField, divisor } = await req.json() as {
      workspaceId: string;
      amountField: string; // ex: "sale_amount", "charge_amount", "value"
      divisor: number;     // 100 se em centavos, 1 se já em reais
    };

    if (!workspaceId || !amountField) {
      return NextResponse.json({ error: "workspaceId e amountField são obrigatórios" }, { status: 400 });
    }

    const db = getAdminDb();
    const snapshot = await db
      .collection("webhook_events")
      .where("workspaceId", "==", workspaceId)
      .where("source", "==", "kiwify")
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ message: "Nenhum documento encontrado", updated: 0 });
    }

    let updated = 0;
    const BATCH_SIZE = 400;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);

      for (const doc of chunk) {
        const raw = doc.data() as Record<string, unknown>;
        const rawAmount = raw[amountField] as number | undefined;

        if (rawAmount !== undefined && rawAmount !== null) {
          const correctedAmount = Number(rawAmount) / (divisor ?? 1);
          batch.update(doc.ref, { amount: correctedAmount });
          updated++;
        }
      }

      await batch.commit();
    }

    return NextResponse.json({ updated, total: docs.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 500 }
    );
  }
}