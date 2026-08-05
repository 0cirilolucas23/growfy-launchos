/**
 * Growfy LaunchOS — Notify Admin on New User Signup
 *
 * POST /api/admin/notify-new-user
 *   Body: { name, email, companyName?, phone?, role?, provider }
 *   Auth: usuário autenticado (via Firebase ID Token). O uid do token
 *     precisa bater com o email do body (evita spam).
 *
 *   Grava/atualiza pending_users/{uid} via Admin SDK (mais confiável que
 *   depender de rules) e envia email pros admins em ADMIN_EMAILS.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getAdminEmails } from "@/lib/admin-service";

interface NotifyBody {
  name?: string;
  email?: string;
  companyName?: string;
  phone?: string;
  role?: string;
  provider?: "email" | "google";
}

async function sendAdminEmail(user: {
  name: string;
  email: string;
  uid: string;
  companyName?: string;
  phone?: string;
  role?: string;
  provider: string;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.ALERT_EMAIL_FROM ?? "Growfy LaunchOS <noreply@growfy.com.br>";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://growfy-launchos.vercel.app";
  const admins = getAdminEmails();
  if (!RESEND_API_KEY || admins.length === 0) {
    console.warn(
      "[notify-new-user] RESEND_API_KEY ou ADMIN_EMAILS ausente — email não enviado"
    );
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px;">
  <div style="background: #fff; border-radius: 12px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #08080A; padding: 24px; text-align: center;">
      <span style="color: white; font-weight: 900; font-size: 16px;">Growfy LaunchOS</span>
    </div>
    <div style="padding: 28px 24px;">
      <h1 style="font-size: 18px; font-weight: 900; color: #08080A; margin: 0 0 12px;">
        Novo usuário aguardando aprovação
      </h1>
      <p style="color: #666; font-size: 13px; margin: 0 0 20px;">
        Um novo usuário se cadastrou e precisa ser vinculado a um workspace.
      </p>
      <div style="background: #f8f8f8; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #333;">
        <p style="margin: 4px 0;"><strong>Nome:</strong> ${user.name || "(não informado)"}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${user.email}</p>
        ${user.companyName ? `<p style="margin: 4px 0;"><strong>Empresa:</strong> ${user.companyName}</p>` : ""}
        ${user.phone ? `<p style="margin: 4px 0;"><strong>WhatsApp:</strong> ${user.phone}</p>` : ""}
        ${user.role ? `<p style="margin: 4px 0;"><strong>Cargo:</strong> ${user.role}</p>` : ""}
        <p style="margin: 4px 0;"><strong>Login via:</strong> ${user.provider}</p>
        <p style="margin: 4px 0; font-family: monospace; font-size: 11px; color: #999;"><strong>UID:</strong> ${user.uid}</p>
      </div>
      <a href="${APP_URL}/dashboard/admin/usuarios"
        style="display: block; background: #5050F2; color: white; text-align: center; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        Aprovar e vincular a workspace →
      </a>
    </div>
    <div style="padding: 12px 24px; text-align: center; font-size: 10px; color: #bbb; border-top: 1px solid #f0f0f0;">
      Growfy LaunchOS · Notificação automática
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: admins,
      subject: `[LaunchOS] Novo cadastro pendente: ${user.name || user.email}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("[notify-new-user] Falha no envio:", await res.text());
  } else {
    console.log(`[notify-new-user] Email enviado para ${admins.join(", ")}`);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as NotifyBody;

    // Email do body precisa bater com o do token (evita alguém disparar email fake)
    if (body.email && body.email.toLowerCase() !== auth.email.toLowerCase()) {
      return NextResponse.json({ error: "Email não confere" }, { status: 403 });
    }

    // Staff não vira pending — ignora silenciosamente
    if (auth.isStaff) {
      return NextResponse.json({ ok: true, staff: true });
    }

    const db = getAdminDb();
    const uid = auth.uid;
    const email = auth.email;
    const name = body.name?.trim() || "";
    const companyName = body.companyName?.trim() || undefined;
    const phone = body.phone?.trim() || undefined;
    const role = body.role?.trim() || undefined;
    const provider = body.provider ?? "email";

    // Se já existe (usuário fez signup 2x), mantém o createdAt original
    const ref = db.collection("pending_users").doc(uid);
    const existing = await ref.get();
    if (!existing.exists) {
      await ref.set({
        email,
        name,
        companyName: companyName ?? null,
        phone: phone ?? null,
        role: role ?? null,
        provider,
        createdAt: new Date(),
      });
      await sendAdminEmail({ uid, email, name, companyName, phone, role, provider });
    }

    return NextResponse.json({ ok: true, pending: true });
  } catch (error) {
    console.error("[notify-new-user]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 500 }
    );
  }
}
