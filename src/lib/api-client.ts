/**
 * Growfy LaunchOS — API Client
 *
 * Wrapper do fetch que anexa Authorization: Bearer <idToken> nas chamadas
 * pros endpoints /api/**. Usa o usuário Firebase Auth atualmente logado.
 *
 * Se não houver usuário logado, chama fetch sem token (pra endpoints públicos).
 * Endpoints protegidos com requireAuth vão devolver 401 nesse caso.
 */
import { auth } from "@/lib/firebase";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  const headers = new Headers(init.headers ?? {});

  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (err) {
      console.warn("[apiFetch] Falha ao obter idToken:", err);
    }
  }

  return fetch(input, { ...init, headers });
}
