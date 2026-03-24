"use client";

import React, { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { updateWorkspace } from "@/lib/workspace-service";
import {
  Settings, Save, Copy, Check, Loader2,
  Globe, Zap, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-white/30">
        {label}
      </label>
      {description && <p className="text-[11px] text-white/20">{description}</p>}
      {children}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-all shrink-0"
    >
      {copied ? <Check className="h-3 w-3 text-[#00D861]" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function WebhookURL({ platform, workspaceId }: { platform: string; workspaceId: string }) {
  const url = `https://growfy-launchos.vercel.app/api/webhooks/${platform}?workspace=${workspaceId}`;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <code className="flex-1 truncate text-[11px] text-white/40 font-mono">{url}</code>
      <CopyButton value={url} />
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-white/20 focus:bg-white/[0.06]";

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState("");

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name);
      setClientName(activeWorkspace.clientName);
      setMetaAdAccountId(activeWorkspace.metaAdAccountId ?? "");
      setMetaAccessToken(activeWorkspace.metaAccessToken ?? "");
      setGoogleAdsCustomerId(activeWorkspace.googleAdsCustomerId ?? "");
    }
  }, [activeWorkspace]);

  async function handleSave() {
    if (!activeWorkspace) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateWorkspace(activeWorkspace.id, {
        name: name.trim(),
        clientName: clientName.trim(),
        metaAdAccountId: metaAdAccountId.trim(),
        metaAccessToken: metaAccessToken.trim(),
        googleAdsCustomerId: googleAdsCustomerId.trim(),
        initials: name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
      });
      await refreshWorkspaces();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Erro ao salvar. Tente novamente.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-white/30">Nenhum workspace selecionado</p>
      </div>
    );
  }

  const platforms = [
    { id: "hotmart", name: "Hotmart", initial: "H" },
    { id: "kiwify", name: "Kiwify", initial: "K" },
    { id: "eduzz", name: "Eduzz", initial: "E" },
  ];

  return (
    <div className="flex-1 space-y-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <Settings className="h-4 w-4 text-white/50" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Configurações</h1>
            <p className="text-[11px] text-white/25">Workspace: {activeWorkspace.name}</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            saved
              ? "bg-[#00D861]/15 border border-[#00D861]/20 text-[#00D861]"
              : "bg-white text-[#08080A] hover:bg-white/90",
            "disabled:opacity-50"
          )}
        >
          {isSaving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
          ) : saved ? (
            <><Check className="h-3.5 w-3.5" /> Salvo!</>
          ) : (
            <><Save className="h-3.5 w-3.5" /> Salvar alterações</>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#E85D22]/20 bg-[#E85D22]/8 px-4 py-3">
          <p className="text-sm text-[#E85D22]">{error}</p>
        </div>
      )}

      {/* Workspace info */}
      <Section title="Informações do Workspace">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do Workspace" description="Identificação interna">
            <input type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: ByShua - Jul/25"
              className={inputClass} />
          </Field>
          <Field label="Nome do Cliente" description="Nome exibido nos relatórios">
            <input type="text" value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: ByShua"
              className={inputClass} />
          </Field>
        </div>

        {/* Workspace ID */}
        <Field label="ID do Workspace" description="Use este ID nas URLs dos webhooks">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <code className="flex-1 text-sm font-mono text-white/50">{activeWorkspace.id}</code>
            <CopyButton value={activeWorkspace.id} />
          </div>
        </Field>
      </Section>

      {/* Meta Ads */}
      <Section
        title="Meta Ads"
        description="Configure as credenciais para puxar dados reais do Meta Ads"
      >
        <Field label="ID da Conta de Anúncios" description="Formato: act_XXXXXXXXXX">
          <input type="text" value={metaAdAccountId}
            onChange={(e) => setMetaAdAccountId(e.target.value)}
            placeholder="act_419020624872733"
            className={inputClass} />
        </Field>
        <Field
          label="Access Token"
          description="Token de acesso — use System User Token para não expirar"
        >
          <input type="password" value={metaAccessToken}
            onChange={(e) => setMetaAccessToken(e.target.value)}
            placeholder="••••••••••••••••••••"
            className={inputClass} />
        </Field>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[11px] text-white/25 leading-relaxed">
            💡 Para um token permanente, use o <strong className="text-white/40">System User Token</strong> no Meta Business Manager.
            Tokens gerados no Explorador da API expiram em horas.
          </p>
        </div>
      </Section>

      {/* Google Ads */}
      <Section
        title="Google Ads"
        description="Configure as credenciais para puxar dados reais do Google Ads"
      >
        <Field label="Customer ID" description="Formato: XXXXXXXXXX (sem hífens)">
          <input type="text" value={googleAdsCustomerId}
            onChange={(e) => setGoogleAdsCustomerId(e.target.value)}
            placeholder="9995320021"
            className={inputClass} />
        </Field>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[11px] text-white/25">
            🚧 Integração Google Ads em desenvolvimento.
          </p>
        </div>
      </Section>

      {/* Webhooks */}
      <Section
        title="URLs dos Webhooks"
        description="Configure essas URLs nas plataformas para receber eventos em tempo real"
      >
        <div className="space-y-3">
          {platforms.map((p) => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-[10px] font-black text-white/40">
                  {p.initial}
                </div>
                <span className="text-xs font-semibold text-white/50">{p.name}</span>
              </div>
              <WebhookURL platform={p.id} workspaceId={activeWorkspace.id} />
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[11px] text-white/25 leading-relaxed">
            📌 Copie a URL da plataforma desejada e cole nas configurações de webhook da respectiva plataforma.
          </p>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Zona de perigo">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white/60">Resetar dados do workspace</p>
            <p className="text-xs text-white/25 mt-0.5">Remove todos os eventos importados deste workspace</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-[#E85D22]/20 px-3 py-2 text-xs font-semibold text-[#E85D22]/60 hover:bg-[#E85D22]/8 hover:text-[#E85D22] transition-all"
            onClick={() => alert("Em breve — funcionalidade em desenvolvimento")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Resetar dados
          </button>
        </div>
      </Section>
    </div>
  );
}