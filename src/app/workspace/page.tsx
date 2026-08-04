"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { Workspace, WorkspacePlatform } from "@/lib/workspace-service";
import { Plus, Zap, Users, ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import IconBranco from "@/icons/IconBranco.svg";

// ─────────────────────────────────────────────
// Create Workspace Form
// ─────────────────────────────────────────────

type PlatformKey = "kiwify" | "hotmart" | "eduzz" | "kommo";

const PLATFORM_OPTIONS: { key: PlatformKey; label: string }[] = [
  { key: "kiwify", label: "Kiwify" },
  { key: "hotmart", label: "Hotmart" },
  { key: "eduzz", label: "Eduzz" },
  { key: "kommo", label: "Kommo" },
];

function CreateWorkspaceForm({ onCreated }: { onCreated: (w: Workspace) => void }) {
  const { createNewWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>({
    kiwify: true,
    hotmart: true,
    eduzz: true,
    kommo: false,
  });
  const [kommoSubdomain, setKommoSubdomain] = useState("");
  const [kommoAccessToken, setKommoAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlatform(key: PlatformKey) {
    setPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const platformsArray: WorkspacePlatform[] = PLATFORM_OPTIONS.map((p) => ({
        name: p.key,
        enabled: platforms[p.key],
      }));

      const workspace = await createNewWorkspace({
        name: name.trim(),
        clientName: clientName.trim() || name.trim(),
        platforms: platformsArray,
        ...(platforms.kommo && {
          kommoSubdomain: kommoSubdomain.trim(),
          kommoAccessToken: kommoAccessToken.trim(),
        }),
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
        <label className="block text-xs font-medium tracking-wider text-white/80 mb-1.5">
          Nome do Workspace*
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: ByShua - Lançamento Jul/25"
          required
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#5050f280] transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-medium tracking-wider text-white/80 mb-1.5 required:*:clientName">
          Nome do Cliente*
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Ex: ByShua"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#5050f280] transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-medium tracking-wider text-white/80 mb-1.5">
          Plataformas*
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const enabled = platforms[p.key];
            return (
              <button
                type="button"
                key={p.key}
                onClick={() => togglePlatform(p.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                  enabled
                    ? "border-[#00d86165] bg-[#00d8611c] text-[#95f5c0]"
                    : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:text-white/70"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-all",
                    enabled ? "border-white bg-white" : "border-white/20"
                  )}
                >
                  {enabled && <Check className="h-3 w-3 text-[#08080A]" />}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      {platforms.kommo && (
        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#5050f208] p-4">
          <p className="text-xs text-white/40 mb-6">
            Credenciais Kommo — você poderá sincronizar o funil depois em Configurações.
          </p>
          <div>
            <label className="block text-xs font-medium tracking-wider text-white/80 mb-1.5">
              Subdomínio Kommo*
            </label>
            <input
              type="text"
              value={kommoSubdomain}
              onChange={(e) => setKommoSubdomain(e.target.value)}
              placeholder="ex: growfy"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#5050f280] transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-wider text-white/80 mb-1.5">
              Access Token*
            </label>
            <input
              type="password"
              value={kommoAccessToken}
              onChange={(e) => setKommoAccessToken(e.target.value)}
              placeholder="Long-lived token"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#5050f280] transition-all"
            />
          </div>
        </div>
      )}
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

  const isStaff = /@growfy\.com\.br$/i.test(user?.email ?? "");

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

  // Nao-staff sem workspaces = aguardando aprovacao
  const isPending = !isStaff && workspaces.length === 0;

  return (
    <div className="min-h-screen bg-[#08080A] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <IconBranco className="h-8 w-8" aria-label="Logo" />
          {/*<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600">
            <Zap className="h-4 w-4 text-[#08080A]" />
          </div>*/}
          <div>
            <p className="text-base font-black text-white leading-none">Growfy</p>
            <p className="text-xs text-white/30 leading-none mt-2">LaunchOS</p>
          </div>
        </div>

        {/* Estado pending — usuario nao-staff sem workspaces */}
        {isPending && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Aguardando aprovação
              </h1>
              <p className="mt-2 text-sm text-white/40 leading-relaxed">
                Olá, {user?.displayName?.split(" ")[0] ?? "usuário"}. Sua conta foi criada
                com sucesso e nosso time já foi notificado. Assim que aprovarmos seu
                acesso a um workspace, você receberá uma confirmação e poderá entrar.
              </p>
            </div>
            <div className="rounded-xl border border-[#FAE125]/20 bg-[#FAE125]/5 p-4">
              <p className="text-xs text-[#FAE125]/80 leading-relaxed">
                📌 Se precisar acelerar, entre em contato com o administrador do sistema
                informando o email <strong>{user?.email}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Header (staff ou usuario com workspaces) */}
        {!isPending && (
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
        )}

        {/* Workspace list */}
        {!isPending && workspaces.length > 0 && !showCreate && (
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onClick={() => handleSelectWorkspace(ws)}
              />
            ))}
            {/* Botao de adicionar workspace so aparece pra staff */}
            {isStaff && (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/[0.08] p-4 text-sm text-white/30 hover:border-white/15 hover:text-white/50 transition-all"
              >
                <Plus className="h-4 w-4" />
                Adicionar novo workspace
              </button>
            )}
          </div>
        )}

        {/* Create form — so pra staff */}
        {!isPending && isStaff && (workspaces.length === 0 || showCreate) && (
          <div className="space-y-4">
            {showCreate && (
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-[#b6b6d1] underline hover:text-[#b6b6f1]  transition-colors mb-2"
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