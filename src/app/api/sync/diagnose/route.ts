/**
 * Growfy LaunchOS — Diagnose Google SA credentials
 *
 * GET /api/sync/diagnose
 *   Auth: staff only (@growfy.com.br)
 *   Retorna metadados da chave SA (SEM expor a chave) pra debugar
 *   problemas de formatação no Vercel env.
 */
import { NextRequest, NextResponse } from "next/server";
import { diagnoseCredentials } from "@/lib/google-sheets-service";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { staffOnly: true });
  if (!auth.ok) return auth.response;
  return NextResponse.json(diagnoseCredentials());
}
