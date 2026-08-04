"use client";

/**
 * Tela admin: aprovar usuários pendentes e vinculá-los a workspaces.
 * Só staff (@growfy.com.br) tem acesso. Camadas de proteção:
 *   1. Guard client-side (redireciona não-staff pra /workspace)
 *   2. Endpoints /api/admin/* já são staffOnly
 *   3. Firestore rules bloqueiam pending_users pra não-staff
 */
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiFetch } from "@/lib/api-client";
import { Shield, Loader2, Check, X, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingUser {
  uid: string;
  email: string;
  name: string;
  companyName?: string;
  phone?: string;
  role?: string;
  provider: "email" | "google";
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { workspaces } = useWorkspace();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState<string | null>(null);
  const [approvedMsg, setApprovedMsg] = useState<string | null>(null);

  const isStaff = /@growfy\.com\.br$/i.test(user?.email ?? "");

  // Guard: redireciona nao-staff
  useEffect(() => {
    if (!authLoading && user && !isStaff) {
      router.replace("/workspace");
    }
  }, [authLoading, user, isStaff, router]);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/pending-users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao listar");
      setPending(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStaff) loadPending();
  }, [isStaff, loadPending]);

  async function handleApprove(uid: string) {
    const workspaceId = selectedWorkspace[uid];
    if (!workspaceId) {
      setError("Selecione um workspace antes de aprovar");
      return;
    }
    setApproving(uid);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/pending-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar");
      const wsName = workspaces.find((w) => w.id === workspaceId)?.name ?? workspaceId;
      const userName = pending.find((p) => p.uid === uid)?.name ?? uid;
      setApprovedMsg(`✓ ${userName} vinculado ao workspace "${wsName}"`);
      setTimeout(() => setApprovedMsg(null), 5000);
      await loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setApproving(null);
    }
  }

  if (authLoading || (user && !isStaff)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <Shield className="h-4 w-4 text-white/50" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">
              Aprovar Usuários
            </h1>
            <p className="text-[11px] text-white/25">
              Área restrita · Vincule novos cadastros a workspaces existentes
            </p>
          </div>
        </div>

        <button
          onClick={loadPending}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.06] disabled:opacity-40"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#E85D22]/20 bg-[#E85D22]/8 px-4 py-3">
          <p className="text-sm text-[#E85D22]">{error}</p>
        </div>
      )}

      {approvedMsg && (
        <div className="rounded-xl border border-[#00D861]/20 bg-[#00D861]/8 px-4 py-3">
          <p className="text-sm text-[#00D861]">{approvedMsg}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 text-white/30 animate-spin" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-10 text-center">
          <Users className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white/60">Nenhum usuário pendente</p>
          <p className="text-xs text-white/30 mt-1">
            Novos cadastros aparecerão aqui automaticamente
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const dateStr = new Date(p.createdAt).toLocaleString("pt-BR");
            const currentSelection = selectedWorkspace[p.uid] ?? "";
            const isApprovingThis = approving === p.uid;
            return (
              <div
                key={p.uid}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{p.name || "(sem nome)"}</p>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          p.provider === "google"
                            ? "bg-[#4285F4]/15 text-[#4285F4]"
                            : "bg-white/10 text-white/40"
                        )}
                      >
                        {p.provider}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">{p.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/30 mt-1">
                      {p.companyName && <span>Empresa: {p.companyName}</span>}
                      {p.role && <span>Cargo: {p.role}</span>}
                      {p.phone && <span>WhatsApp: {p.phone}</span>}
                      <span>Cadastro: {dateStr}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-2 border-t border-white/[0.05]">
                  <select
                    value={currentSelection}
                    onChange={(e) =>
                      setSelectedWorkspace((prev) => ({ ...prev, [p.uid]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-white/20"
                  >
                    <option value="" className="bg-[#08080A]">
                      Selecione um workspace...
                    </option>
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id} className="bg-[#08080A]">
                        {ws.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleApprove(p.uid)}
                    disabled={!currentSelection || isApprovingThis}
                    className="flex items-center gap-2 rounded-lg border border-[#00D861]/30 bg-[#00D861]/10 px-3 py-2 text-xs font-bold text-[#00D861] hover:bg-[#00D861]/15 disabled:opacity-40"
                  >
                    {isApprovingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Aprovar e vincular
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
