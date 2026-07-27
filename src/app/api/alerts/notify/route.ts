import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { metric, condition, threshold, currentValue, email } = await req.json() as {
      metric: string;
      condition: string;
      threshold: string;
      currentValue: string;
      email: string;
    };

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM = process.env.ALERT_EMAIL_FROM ?? "Growfy LaunchOS <noreply@growfy.com.br>";

    if (!RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "RESEND_API_KEY não configurado" });
    }

    const isBelow = condition === "abaixo de";
    const accentColor = isBelow ? "#E85D22" : "#00D861";
    const icon = isBelow ? "⚠️" : "🚀";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="background:#fff;border-radius:12px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#08080A;padding:28px 24px;text-align:center;">
      <span style="color:white;font-weight:900;font-size:18px;letter-spacing:-0.5px;">Growfy LaunchOS</span>
    </div>
    <div style="padding:28px 24px;">
      <div style="display:inline-block;background:${accentColor}18;border:1px solid ${accentColor}40;border-radius:8px;padding:8px 14px;margin-bottom:20px;">
        <span style="color:${accentColor};font-weight:700;font-size:13px;">${icon} Alerta disparado</span>
      </div>
      <h1 style="font-size:20px;font-weight:900;color:#08080A;margin:0 0 8px;">
        ${metric} está ${condition} ${threshold}
      </h1>
      <p style="color:#666;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Seu alerta foi ativado porque o valor atual de <strong>${metric}</strong>
        chegou a <strong style="color:${accentColor};">${currentValue}</strong>,
        que está ${condition} o limite configurado de <strong>${threshold}</strong>.
      </p>
      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px;">
        <table width="100%" style="font-size:13px;color:#444;">
          <tr>
            <td style="padding:4px 0;color:#888;">Métrica</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;">${metric}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#888;">Valor atual</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:${accentColor};">${currentValue}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#888;">Limite configurado</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;">${condition} ${threshold}</td>
          </tr>
        </table>
      </div>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://growfy-launchos.vercel.app"}/dashboard"
        style="display:block;background:#08080A;color:white;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">
        Ver Dashboard →
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;font-size:11px;color:#bbb;border-top:1px solid #f0f0f0;">
      Growfy LaunchOS · Para parar de receber esses alertas, acesse Configurações no dashboard.
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
        subject: `${icon} Alerta: ${metric} está ${condition} ${threshold}`,
        html,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: await res.text() }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
