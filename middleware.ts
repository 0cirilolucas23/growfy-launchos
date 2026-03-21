import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Rotas protegidas — exigem login
// ─────────────────────────────────────────────

const PROTECTED_ROUTES = ["/dashboard"];

// ─────────────────────────────────────────────
// Rotas públicas — redireciona para dashboard se já logado
// ─────────────────────────────────────────────

const AUTH_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Firebase persiste a sessão no localStorage (client-side),
  // então usamos um cookie auxiliar que definimos no login.
  // O cookie "growfy_session" é setado pelo AuthContext ao detectar usuário.
  const session = request.cookies.get("growfy_session")?.value;

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Rota protegida sem sessão → redireciona para login
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Já logado tentando acessar login → redireciona para dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};