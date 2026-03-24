import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, companyName } = await req.json() as {
      name: string;
      email: string;
      companyName?: string;
    };

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM = process.env.ALERT_EMAIL_FROM ?? "Growfy LaunchOS <noreply@growfy.com.br>";

    if (!RESEND_API_KEY) {
      console.warn("⚠️ RESEND_API_KEY não configurado");
      return NextResponse.json({ ok: true });
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px;">
  <div style="background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #08080A; padding: 32px 24px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: #5050F2; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-weight: 900; font-size: 14px;">G</span>
        </div>
        <span style="color: white; font-weight: 900; font-size: 18px; letter-spacing: -0.5px;">Growfy LaunchOS</span>
      </div>
    </div>
    <div style="padding: 32px 24px;">
      <h1 style="font-size: 22px; font-weight: 900; color: #08080A; margin: 0 0 8px;">
        Bem-vindo, ${name.split(" ")[0]}! 👋
      </h1>
      <p style="color: #666; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Sua conta no <strong>Growfy LaunchOS</strong> foi criada com sucesso${companyName ? ` para <strong>${companyName}</strong>` : ""}.
        Agora você pode centralizar todos os seus dados de lançamentos em um só lugar.
      </p>
      <div style="background: #f8f8f8; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #444; font-weight: 600;">O que você pode fazer agora:</p>
        <ul style="margin: 8px 0 0; padding-left: 16px; font-size: 13px; color: #666; line-height: 2;">
          <li>Criar seu primeiro workspace (cliente)</li>
          <li>Conectar Meta Ads e ver dados reais</li>
          <li>Configurar webhooks Hotmart, Kiwify e Eduzz</li>
          <li>Usar a calculadora de Engenharia Reversa</li>
        </ul>
      </div>
      <a href="https://growfy-launchos.vercel.app/workspace"
        style="display: block; background: #5050F2; color: white; text-align: center; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none;">
        Acessar o Dashboard →
      </a>
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 11px; color: #bbb; border-top: 1px solid #f0f0f0;">
      Growfy LaunchOS · Se não criou essa conta, ignore este e-mail.
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
        to: [email],
        subject: `Bem-vindo ao Growfy LaunchOS, ${name.split(" ")[0]}!`,
        html,
      }),
    });

    if (!res.ok) {
      console.error("❌ [Welcome Email]", await res.text());
    } else {
      console.log(`📧 [Welcome Email] Enviado para ${email}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Welcome Email]", error);
    return NextResponse.json({ ok: true }); // Non-blocking
  }
}