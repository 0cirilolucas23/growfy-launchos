"use client";

import React, { useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { Download, CheckCircle, AlertCircle, Loader2, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

interface PlatformImport {
  id: string;
  name: string;
  logo: string;
  description: string;
  endpoint: string;
  status: "idle" | "loading" | "success" | "error";
  result?: ImportResult;
  error?: string;
}

export default function ImportPage() {
  const { activeWorkspace } = useWorkspace();
  const [platforms, setPlatforms] = useState<PlatformImport[]>([
    {
      id: "kiwify",
      name: "Kiwify",
      logo: "K",
      description: "Importa todo o histórico de vendas, reembolsos e assinaturas",
      endpoint: "/api/import/kiwify",
      status: "idle",
    },
    {
      id: "hotmart",
      name: "Hotmart",
      logo: "H",
      description: "Em breve — importação do histórico Hotmart",
      endpoint: "/api/import/hotmart",
      status: "idle",
    },
    {
      id: "eduzz",
      name: "Eduzz",
      logo: "E",
      description: "Em breve — importação do histórico Eduzz",
      endpoint: "/api/import/eduzz",
      status: "idle",
    },
  ]);

  async function handleImport(platformId: string) {
    if (!activeWorkspace) return;

    setPlatforms((prev) =>
      prev.map((p) => p.id === platformId ? { ...p, status: "loading", result: undefined, error: undefined } : p)
    );

    try {
      const res = await fetch(`/api/import/${platformId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });

      const data = await res.json() as ImportResult & { error?: string };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Erro na importação");
      }

      setPlatforms((prev) =>
        prev.map((p) => p.id === platformId ? { ...p, status: "success", result: data } : p)
      );
    } catch (err) {
      setPlatforms((prev) =>
        prev.map((p) => p.id === platformId
          ? { ...p, status: "error", error: err instanceof Error ? err.message : "Erro desconhecido" }
          : p)
      );
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Database className="h-4 w-4 text-white/50" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Importar Histórico</h1>
          <p className="text-[11px] text-white/25">
            Importa dados históricos das plataformas para o workspace{" "}
            <span className="text-white/40">{activeWorkspace?.name}</span>
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-xl border border-[#FAE125]/15 bg-[#FAE125]/5 p-4">
        <p className="text-xs text-[#FAE125]/80 leading-relaxed">
          ⚠️ A importação pode levar alguns minutos dependendo do volume de dados.
          Não feche a página durante o processo. Cada pedido é verificado antes de salvar —
          importações repetidas não duplicam dados.
        </p>
      </div>

      {/* Platforms */}
      <div className="space-y-3">
        {platforms.map((platform) => {
          const isAvailable = platform.id === "kiwify";
          return (
            <div key={platform.id}
              className={cn(
                "rounded-xl border p-5 transition-all",
                isAvailable ? "border-white/[0.07] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-50"
              )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {/* Logo */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-sm font-black text-white/60">
                    {platform.logo}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{platform.name}</p>
                    <p className="text-xs text-white/30 mt-0.5">{platform.description}</p>

                    {/* Result */}
                    {platform.status === "success" && platform.result && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <span className="flex items-center gap-1.5 text-xs text-[#00D861]">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {platform.result.imported} importados
                        </span>
                        {platform.result.skipped > 0 && (
                          <span className="text-xs text-white/30">
                            {platform.result.skipped} já existiam
                          </span>
                        )}
                        {platform.result.errors > 0 && (
                          <span className="text-xs text-[#E85D22]">
                            {platform.result.errors} erros
                          </span>
                        )}
                        <span className="text-xs text-white/20">
                          Total: {platform.result.total}
                        </span>
                      </div>
                    )}

                    {/* Error */}
                    {platform.status === "error" && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-[#E85D22]">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {platform.error}
                      </div>
                    )}
                  </div>
                </div>

                {/* Button */}
                {isAvailable && (
                  <button
                    onClick={() => handleImport(platform.id)}
                    disabled={platform.status === "loading" || !activeWorkspace}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all",
                      platform.status === "success"
                        ? "border border-[#00D861]/20 bg-[#00D861]/8 text-[#00D861]"
                        : platform.status === "error"
                        ? "border border-[#E85D22]/20 bg-[#E85D22]/8 text-[#E85D22]"
                        : "bg-white text-[#08080A] hover:bg-white/90",
                      "disabled:opacity-50"
                    )}
                  >
                    {platform.status === "loading" ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando...</>
                    ) : platform.status === "success" ? (
                      <><CheckCircle className="h-3.5 w-3.5" /> Reimportar</>
                    ) : (
                      <><Download className="h-3.5 w-3.5" /> Importar histórico</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}