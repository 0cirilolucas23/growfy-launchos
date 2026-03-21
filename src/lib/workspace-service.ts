/**
 * Growfy LaunchOS — Workspace Service
 * Multi-tenant: cada workspace representa um cliente
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  clientName: string;
  ownerId: string;
  members: string[]; // Firebase UIDs
  platforms: WorkspacePlatform[];
  metaAdAccountId?: string;
  metaAccessToken?: string;
  googleAdsCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
  color: string; // accent color for UI
  initials: string; // 2 letters for avatar
}

export interface WorkspacePlatform {
  name: "hotmart" | "kiwify" | "eduzz";
  enabled: boolean;
  webhookSecret?: string;
}

export interface CreateWorkspaceInput {
  name: string;
  clientName: string;
  color?: string;
  platforms?: WorkspacePlatform[];
  metaAdAccountId?: string;
  metaAccessToken?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date();
}

function docToWorkspace(id: string, data: Record<string, unknown>): Workspace {
  return {
    id,
    name: data.name as string,
    clientName: data.clientName as string,
    ownerId: data.ownerId as string,
    members: (data.members as string[]) ?? [],
    platforms: (data.platforms as WorkspacePlatform[]) ?? [],
    metaAdAccountId: data.metaAdAccountId as string | undefined,
    metaAccessToken: data.metaAccessToken as string | undefined,
    googleAdsCustomerId: data.googleAdsCustomerId as string | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    color: (data.color as string) ?? "#5050F2",
    initials: (data.initials as string) ?? getInitials(data.name as string),
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

/**
 * Busca todos os workspaces que o usuário tem acesso
 */
export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const q = query(
    collection(db, "workspaces"),
    where("members", "array-contains", userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    docToWorkspace(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * Busca um workspace por ID
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const ref = doc(db, "workspaces", workspaceId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return docToWorkspace(snapshot.id, snapshot.data() as Record<string, unknown>);
}

/**
 * Cria um novo workspace
 */
export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput
): Promise<Workspace> {
  const id = generateId();
  const initials = getInitials(input.name);
  const color = input.color ?? WORKSPACE_COLORS[Math.floor(Math.random() * WORKSPACE_COLORS.length)];

  const data = {
    name: input.name,
    clientName: input.clientName,
    ownerId: userId,
    members: [userId],
    platforms: input.platforms ?? [
      { name: "hotmart", enabled: true },
      { name: "kiwify", enabled: true },
      { name: "eduzz", enabled: true },
    ],
    metaAdAccountId: input.metaAdAccountId ?? "",
    metaAccessToken: input.metaAccessToken ?? "",
    googleAdsCustomerId: "",
    color,
    initials,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "workspaces", id), data);

  return {
    id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Atualiza um workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Omit<Workspace, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "workspaces", workspaceId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Adiciona um membro ao workspace
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<void> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Workspace não encontrado");

  if (!workspace.members.includes(userId)) {
    await updateDoc(doc(db, "workspaces", workspaceId), {
      members: [...workspace.members, userId],
      updatedAt: serverTimestamp(),
    });
  }
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const WORKSPACE_COLORS = [
  "#5050F2", // purple
  "#00D861", // green
  "#E85D22", // orange
  "#FAE125", // yellow
  "#06B6D4", // cyan
  "#8B5CF6", // violet
  "#EC4899", // pink
];