"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { Workspace } from "@/lib/workspace-service";
import { Plus, Zap, Users, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Create Workspace Form
// ─────────────────────────────────────────────

function CreateWorkspaceForm({ onCreated }: { onCreated: (w: Workspace) => void }) {
  const { createNewWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const workspace = await createNewWorkspace({
        name: name.trim(),
        clientName: clientName.trim() || name.trim(),
      });
      onCreated(workspace);
    } catch (err) {
      setError("Erro ao criar workspace. Tente novamente.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-[#E85D22]/10 border border-[#E85D22]/20 px-4 py-3">
          <p className="text-sm text-[#E85D22]">{error}</p>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5">
          Nome do Workspace
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: ByShua - Lançamento Jul/25"
          required
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5">
          Nome do Cliente
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Ex: ByShua"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !name.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#08080A] hover:bg-white/90 transition-all disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Criar Workspace
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Workspace Card
// ─────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  onClick,
}: {
  workspace: Workspace;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 hover:border-white/15 hover:bg-white/[0.06] transition-all group text-left"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
        style={{ backgroundColor: workspace.color }}
      >
        {workspace.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{workspace.name}</p>
        <p className="text-xs text-white/30 mt-0.5">{workspace.clientName}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function WorkspacePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { workspaces, setActiveWorkspace, isLoading } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);

  function handleSelectWorkspace(workspace: Workspace) {
    setActiveWorkspace(workspace);
    router.push("/dashboard");
  }

  function handleCreated(workspace: Workspace) {
    router.push("/dashboard");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08080A] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080A] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
            <Zap className="h-4 w-4 text-[#08080A]" />
          </div>
          <div>
            <p className="text-base font-black text-white leading-none">Growfy</p>
            <p className="text-xs text-white/30 leading-none mt-0.5">LaunchOS</p>
          </div>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {workspaces.length === 0 ? "Crie seu primeiro workspace" : "Selecione um workspace"}
          </h1>
          <p className="mt-1 text-sm text-white/30">
            {workspaces.length === 0
              ? "Um workspace representa um cliente ou projeto"
              : `Olá, ${user?.displayName?.split(" ")[0] ?? "usuário"} — qual cliente quer acessar?`}
          </p>
        </div>

        {/* Workspace list */}
        {workspaces.length > 0 && !showCreate && (
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onClick={() => handleSelectWorkspace(ws)}
              />
            ))}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/[0.08] p-4 text-sm text-white/30 hover:border-white/15 hover:text-white/50 transition-all"
            >
              <Plus className="h-4 w-4" />
              Adicionar novo workspace
            </button>
          </div>
        )}

        {/* Create form */}
        {(workspaces.length === 0 || showCreate) && (
          <div className="space-y-4">
            {showCreate && (
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                ← Voltar para a lista
              </button>
            )}
            <CreateWorkspaceForm onCreated={handleCreated} />
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <Users className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
          <p className="text-xs text-white/30 leading-relaxed">
            Cada workspace é isolado — dados, webhooks e configurações são separados por cliente.
          </p>
        </div>
      </div>
    </div>
  );
}