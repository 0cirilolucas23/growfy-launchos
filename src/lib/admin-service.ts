/**
 * Growfy LaunchOS — Admin Service
 *
 * Gerencia usuários pendentes de aprovação. Fluxo:
 *   1. Usuário se cadastra (email ou Google) → cliente escreve doc em
 *      pending_users/{uid} via Firestore rules (uid == request.auth.uid)
 *   2. Cliente chama /api/admin/notify-new-user pra disparar email pros
 *      admins listados em ADMIN_EMAILS.
 *   3. Admin abre /dashboard/admin/usuarios → vê lista via GET
 *      /api/admin/pending-users (staffOnly).
 *   4. Admin escolhe workspace e clica aprovar → POST /api/admin/pending-users
 *      { uid, workspaceId } (staffOnly): adiciona uid em workspaces.members
 *      e deleta o pending_user.
 */
import { getAdminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface PendingUser {
  uid: string;
  email: string;
  name: string;
  companyName?: string;
  phone?: string;
  role?: string;
  provider: "email" | "google";
  createdAt: Date;
}

/**
 * Lista usuários pendentes de aprovação.
 */
export async function listPendingUsers(): Promise<PendingUser[]> {
  const db = getAdminDb();
  const snap = await db.collection("pending_users").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt;
    const createdDate =
      createdAt && typeof (createdAt as { toDate?: () => Date }).toDate === "function"
        ? (createdAt as { toDate: () => Date }).toDate()
        : new Date();
    return {
      uid: d.id,
      email: String(data.email ?? ""),
      name: String(data.name ?? ""),
      companyName: data.companyName as string | undefined,
      phone: data.phone as string | undefined,
      role: data.role as string | undefined,
      provider: (data.provider as PendingUser["provider"]) ?? "email",
      createdAt: createdDate,
    };
  });
}

/**
 * Aprova um usuário pendente vinculando-o a um workspace.
 * - Adiciona uid em workspaces/{workspaceId}.members (arrayUnion)
 * - Deleta pending_users/{uid}
 */
export async function approvePendingUser(uid: string, workspaceId: string): Promise<void> {
  const db = getAdminDb();
  const wsRef = db.collection("workspaces").doc(workspaceId);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    throw new Error("Workspace não encontrado");
  }
  await wsRef.update({
    members: FieldValue.arrayUnion(uid),
    updatedAt: new Date(),
  });
  await db.collection("pending_users").doc(uid).delete();
}

/**
 * Retorna a lista de emails admin configurados via env ADMIN_EMAILS
 * (separados por vírgula). Se vazio, retorna []
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}
