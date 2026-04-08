"use client";

import { useState, useEffect } from "react";
import { Download, AlertTriangle, CheckCircle, Loader2, Database } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
  message?: string;
}

interface PlatformStatus {
  count: number | null;
  lastResult: ImportResult | null;
  isImporting: boolean;
  error: string | null;
}

export default function ImportarPage() {
  const { activeWorkspace: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const [kiwify, setKiwify] = useState<PlatformStatus>({
    count: null,
    lastResult: null,
    isImporting: false,
    error: null,
  });

  // ✅ Busca contagem com timeout de 5s — nunca trava
  useEffect(() => {
    if (!workspaceId) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`/api/import/kiwify?workspace=${workspaceId}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: { kiwify_events?: number }) => {
        setKiwify((prev) => ({ ...prev, count: data.kiwify_events ?? 0 }));
      })
      .catch(() => {
        // Timeout ou erro — mostra 0 e segue
        setKiwify((prev) => ({ ...prev, count: 0 }));
      })
      .finally(() => clearTimeout(timeout));
  }, [workspaceId]);

  async function handleKiwifyImport() {
    if (!workspaceId) return;

    setKiwify((prev) => ({ ...prev, isImporting: true, error: null, lastResult: null }));

    try {
      const res = await fetch("/api/import/kiwify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      const data = (await res.json()) as ImportResult & { error?: string };

      if (data.error) throw new Error(data.error);

      setKiwify((prev) => ({
        ...prev,
        isImporting: false,
        lastResult: data,
        count: (prev.count ?? 0) + data.imported,
      }));
    } catch (err) {
      setKiwify((prev) => ({
        ...prev,
        isImporting: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      }));
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/60">
          <Download className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Importar Histórico</h1>
          <p className="text-xs text-white/30">
            Importa dados históricos das plataformas para o workspace{" "}
            <span className="text-white/60">{workspace?.name}</span>
          </p>
        </div>
      </div>

      {/* Aviso */}
      <div className="rounded-xl border border-[#FAE125]/20 bg-[#FAE125]/5 p-4 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-[#FAE125]/70 shrink-0 mt-0.5" />
        <p className="text-xs text-[#FAE125]/70">
          A importação pode levar alguns minutos dependendo do volume de dados. Não feche a página durante o processo.
          Cada pedido é verificado antes de salvar — importações repetidas não duplicam dados.
        </p>
      </div>

      {/* Plataformas */}
      <div className="space-y-3">

        {/* Kiwify */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5050F2]/10 border border-[#5050F2]/20">
                <span className="text-sm font-black text-[#5050F2]">K</span>
              </div>
              <div>
                <p className="font-bold text-white">Kiwify</p>
                <p className="text-xs text-white/30">Importa todo o histórico de vendas, reembolsos e assinaturas</p>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-white/20" />
                  {kiwify.count === null ? (
                    <span className="text-[10px] text-white/20">verificando...</span>
                  ) : (
                    <span className="text-[10px] text-white/40">
                      {kiwify.count === 0
                        ? "Nenhum evento salvo ainda"
                        : `${kiwify.count} eventos salvos no Firestore`}
                    </span>
                  )}
                </div>

                {kiwify.lastResult && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#00D861]/10 border border-[#00D861]/20 px-2 py-0.5 text-[10px] text-[#00D861]">
                      <CheckCircle className="h-2.5 w-2.5" />
                      {kiwify.lastResult.imported} importados
                    </span>
                    {kiwify.lastResult.skipped > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-white/40">
                        {kiwify.lastResult.skipped} já existiam
                      </span>
                    )}
                    {kiwify.lastResult.errors > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E85D22]/10 border border-[#E85D22]/20 px-2 py-0.5 text-[10px] text-[#E85D22]">
                        {kiwify.lastResult.errors} erros
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-white/30">
                      {kiwify.lastResult.total} total
                    </span>
                    {kiwify.lastResult.message && (
                      <span className="text-[10px] text-white/20 mt-1 block">
                        {kiwify.lastResult.message}
                      </span>
                    )}
                  </div>
                )}

                {kiwify.error && (
                  <p className="mt-2 text-xs text-[#E85D22]/80">⚠ {kiwify.error}</p>
                )}

                {kiwify.isImporting && (
                  <p className="mt-2 text-xs text-white/30 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando histórico... pode levar até 1 minuto
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleKiwifyImport}
              disabled={kiwify.isImporting || !workspaceId}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-[#5050F2]/30 bg-[#5050F2]/10 px-3 py-2 text-xs font-bold text-[#5050F2] transition-all hover:bg-[#5050F2]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {kiwify.isImporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {kiwify.isImporting ? "Importando..." : "Importar histórico"}
            </button>
          </div>
        </div>

        {/* Hotmart */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 opacity-40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <span className="text-sm font-black text-white/30">H</span>
            </div>
            <div>
              <p className="font-bold text-white/60">Hotmart</p>
              <p className="text-xs text-white/20">Em breve — importação do histórico Hotmart</p>
            </div>
          </div>
        </div>

        {/* Eduzz */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 opacity-40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <span className="text-sm font-black text-white/30">E</span>
            </div>
            <div>
              <p className="font-bold text-white/60">Eduzz</p>
              <p className="text-xs text-white/20">Em breve — importação do histórico Eduzz</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}