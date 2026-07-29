/**
 * Growfy LaunchOS — API Auth Helper
 *
 * Uso em route handlers:
 *
 *   const auth = await requireAuth(req, { workspaceId });
 *   if (!auth.ok) return auth.response;
 *   // auth.uid, auth.email disponíveis
 *
 * - Valida `Authorization: Bearer <idToken>` via Firebase Admin.
 * - Se `workspaceId` for passado, exige que o uid ∈ workspace.members
 *   OU o email termine em @growfy.com.br (staff interno).
 * - Se `staffOnly: true`, exige @growfy.com.br sempre.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export type AuthResult =
  | { ok: true; uid: string; email: string; isStaff: boolean }
  | { ok: false; response: NextResponse };

export interface RequireAuthOptions {
  workspaceId?: string;
  staffOnly?: boolean;
}

function isStaffEmail(email: string | undefined): boolean {
  return typeof email === "string" && /@growfy\.com\.br$/i.test(email);
}

export async function requireAuth(
  req: NextRequest,
  opts: RequireAuthOptions = {}
): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      ),
    };
  }

  const idToken = match[1].trim();
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid token" }, { status: 401 }),
    };
  }

  const uid = decoded.uid;
  const email = String(decoded.email ?? "");
  const isStaff = isStaffEmail(email);

  if (opts.staffOnly && !isStaff) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Staff only" }, { status: 403 }),
    };
  }

  if (opts.workspaceId) {
    if (isStaff) {
      return { ok: true, uid, email, isStaff };
    }
    const wsDoc = await getAdminDb()
      .collection("workspaces")
      .doc(opts.workspaceId)
      .get();
    if (!wsDoc.exists) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        ),
      };
    }
    const members = (wsDoc.data()?.members as string[] | undefined) ?? [];
    if (!members.includes(uid)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Not a member of this workspace" },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, uid, email, isStaff };
}
