/**
 * Growfy LaunchOS — Middleware
 *
 * Roda em Edge Runtime. NÃO tem acesso ao Firebase Admin SDK, então validações
 * profundas (idToken, staff) ficam nos endpoints e page guards.
 *
 * Camadas de proteção pra /dashboard/admin/*:
 *   1. Middleware (aqui): exige growfy_session cookie
 *   2. Page client: useAuth() checa email @growfy.com.br, redireciona senão
 *   3. Endpoint: requireAuth(req, { staffOnly: true })
 *   4. Firestore rules: pending_users bloqueadas pra não-staff
 */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Área admin: exige sessão logada (validação de staff é feita nas camadas mais baixas)
  if (pathname.startsWith("/dashboard/admin")) {
    const hasSession = req.cookies.get("growfy_session");
    if (!hasSession) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/admin/:path*"],
};
