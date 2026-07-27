/**
 * Growfy LaunchOS — Diagnóstico do sale_amount da Kiwify
 * GET /api/debug/kiwify-sample?workspace=WSID&limit=5
 *
 * Pega os N eventos Kiwify mais recentes do workspace e devolve:
 *   - transactionId + orderRef (pra achar o pedido no painel da Kiwify)
 *   - sale_amount cru (em centavos, como veio no payload/API)
 *   - amount normalizado (o que está gravado hoje em webhook_events.amount)
 *   - dobro do amount (o que a página Meta Ads exibe como faturamento)
 *
 * COMO USAR:
 * 1. GET /api/debug/kiwify-sample?workspace=SEU_WSID&limit=5
 * 2. Copie um transactionId e ache o pedido no painel Kiwify (Vendas → Buscar)
 * 3. Compare o valor pago pelo cliente com as 3 colunas devolvidas:
 *    - Se cliente pagou == `amount_normalized` → hipótese 3 (o *2 está errado)
 *    - Se cliente pagou == `amount_doubled` → hipótese 1 (split ~50%, *2 reconstrói o gross)
 *    - Se cliente pagou está em outro múltiplo → cenário híbrido (bump, coprodutor <50%, etc.)
 *
 * Isso NÃO altera nada no Firestore — só leitura.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "5"), 20);

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace obrigatório" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("webhook_events")
      .where("workspaceId", "==", workspaceId)
      .where("source", "==", "kiwify")
      .where("status", "==", "approved")
      .where("type", "==", "purchase")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    if (snap.empty) {
      return NextResponse.json({
        workspace: workspaceId,
        message: "Nenhum evento Kiwify aprovado encontrado nesse workspace.",
        samples: [],
      });
    }

    const samples = snap.docs.map((doc) => {
      const data = doc.data();
      const raw = (data.raw as Record<string, unknown> | undefined) ?? {};

      // Todos os candidatos a "valor" que a Kiwify pode mandar
      const rawSaleAmount = raw.sale_amount as number | undefined;
      const rawNetAmount = raw.net_amount as number | undefined;
      const rawChargeAmount = raw.charge_amount as number | undefined;
      const rawTotalPrice = raw.total_price as number | undefined;

      const amountNormalized = (data.amount as number | undefined) ?? 0;

      return {
        docId: doc.id,
        transactionId: data.transactionId as string,
        orderRef: (data.orderRef as string | undefined) ?? raw.order_ref ?? null,
        customerEmail: data.customerEmail as string,
        productName: data.productName as string,
        paymentMethod: (data.paymentMethod as string | undefined) ?? raw.payment_method ?? null,
        timestamp: (data.timestamp as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? String(data.timestamp),

        // Valores crus da Kiwify (em centavos)
        raw_kiwify_cents: {
          sale_amount: rawSaleAmount ?? null,
          net_amount: rawNetAmount ?? null,
          charge_amount: rawChargeAmount ?? null,
          total_price: rawTotalPrice ?? null,
        },

        // Como está sendo mostrado hoje
        display: {
          amount_normalized_BRL: amountNormalized,
          amount_doubled_BRL: amountNormalized * 2,
        },

        // Todos os campos do payload — pra você inspecionar tudo
        all_raw_fields: Object.keys(raw),
      };
    });

    return NextResponse.json({
      workspace: workspaceId,
      count: samples.length,
      instructions: [
        "1. Copie um transactionId abaixo",
        "2. Ache o pedido no painel Kiwify (Vendas → Buscar)",
        "3. Compare o valor pago pelo cliente com amount_normalized_BRL e amount_doubled_BRL",
        "4. Se cliente pagou == amount_normalized_BRL → o *2 no dashboard está inflando (bug)",
        "5. Se cliente pagou == amount_doubled_BRL → é split de coprodução, precisa campo splitMultiplier configurável",
        "6. Se não bate com nenhum → me traz o número real que aparece na Kiwify pra eu analisar",
      ],
      samples,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[debug/kiwify-sample]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 500 }
    );
  }
}
