"use client";

import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Target, Users, PhoneCall, TrendingUp, DollarSign, Percent, Calculator } from "lucide-react";
import { calculateReverseEngineering, formatCurrency, formatPercentage, formatNumber, ReverseEngineeringInputs } from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

interface SliderFieldProps {
  label: string; description?: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string;
  accent: string; icon: React.ReactNode;
}

function SliderField({ label, description, value, min, max, step, onChange, format, accent, icon }: SliderFieldProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] text-white/30">
            {icon}
          </div>
          <div>
            <span className="text-xs font-semibold text-white/70">{label}</span>
            {description && <p className="text-[10px] text-white/25">{description}</p>}
          </div>
        </div>
        <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-black tabular-nums text-white">
          {format(value)}
        </span>
      </div>
      <div className="px-1">
        <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
        <div className="mt-1 flex justify-between text-[9px] text-white/15">
          <span>{format(min)}</span><span>{format(max)}</span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, sublabel, accent }: { label: string; value: string; sublabel?: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">{label}</p>
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      {sublabel && <p className="mt-0.5 text-[10px] text-white/25">{sublabel}</p>}
    </div>
  );
}

const DEFAULT: ReverseEngineeringInputs = {
  targetRevenue: 30000, averageTicket: 997, conversionRate: 3,
  leadCost: 8, showRate: 60, closingRate: 30,
};

export default function PlanningPage() {
  const [inputs, setInputs] = useState<ReverseEngineeringInputs>(DEFAULT);
  const result = useMemo(() => calculateReverseEngineering(inputs), [inputs]);

  function update<K extends keyof ReverseEngineeringInputs>(key: K, value: ReverseEngineeringInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  const funnelSteps = [
    { label: "Leads", value: result.leadsNeeded },
    { label: "Prospects", value: result.prospectsNeeded },
    { label: "Calls", value: result.callsNeeded },
    { label: "Vendas", value: result.salesNeeded },
  ];

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Calculator className="h-4 w-4 text-white/50" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Engenharia Reversa</h1>
          <p className="text-[11px] text-white/25">Calcule exatamente o que você precisa para bater sua meta</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Seus Parâmetros</p>
            <div className="space-y-6">
              <SliderField label="Meta de Receita" description="Faturamento bruto desejado" value={inputs.targetRevenue} min={1000} max={500000} step={1000} onChange={v => update("targetRevenue", v)} format={v => formatCurrency(v)} accent="#00D861" icon={<Target className="h-3 w-3" />} />
              <SliderField label="Ticket Médio" description="Valor médio por venda" value={inputs.averageTicket} min={47} max={10000} step={50} onChange={v => update("averageTicket", v)} format={v => formatCurrency(v)} accent="#FAE125" icon={<DollarSign className="h-3 w-3" />} />
              <SliderField label="Taxa de Conversão" description="Leads → Clientes" value={inputs.conversionRate} min={0.1} max={30} step={0.1} onChange={v => update("conversionRate", v)} format={v => formatPercentage(v)} accent="#5050F2" icon={<Percent className="h-3 w-3" />} />
              <SliderField label="Custo por Lead" description="Custo médio de aquisição" value={inputs.leadCost} min={1} max={200} step={0.5} onChange={v => update("leadCost", v)} format={v => formatCurrency(v)} accent="#E85D22" icon={<DollarSign className="h-3 w-3" />} />
              <SliderField label="Taxa de Comparecimento" description="% que aparecem na chamada" value={inputs.showRate} min={10} max={100} step={1} onChange={v => update("showRate", v)} format={v => formatPercentage(v)} accent="#FAE125" icon={<Users className="h-3 w-3" />} />
              <SliderField label="Taxa de Fechamento" description="% de calls que viram vendas" value={inputs.closingRate} min={1} max={100} step={1} onChange={v => update("closingRate", v)} format={v => formatPercentage(v)} accent="#00D861" icon={<PhoneCall className="h-3 w-3" />} />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* Result cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ResultCard label="Leads Necessários" value={formatNumber(result.leadsNeeded)} sublabel={`a ${formatCurrency(inputs.leadCost)}/lead`} accent="#5050F2" />
            <ResultCard label="Investimento Ads" value={formatCurrency(result.adBudgetNeeded)} sublabel="orçamento estimado" accent="#E85D22" />
            <ResultCard label="Calls Necessárias" value={formatNumber(result.callsNeeded)} sublabel={`${formatPercentage(inputs.closingRate)} fechamento`} accent="#FAE125" />
            <ResultCard label="Vendas Esperadas" value={formatNumber(result.salesNeeded)} sublabel={`a ${formatCurrency(inputs.averageTicket)}`} accent="#00D861" />
            <ResultCard label="Lucro Estimado" value={formatCurrency(result.profitEstimate)} sublabel="receita − ads" accent="#00D861" />
            <ResultCard label="ROI" value={formatPercentage(result.roi)} sublabel="retorno sobre investimento" accent={result.roi >= 100 ? "#00D861" : "#E85D22"} />
          </div>

          {/* Funnel */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">Funil de Vendas</h2>
            <div className="space-y-3">
              {funnelSteps.map((step, i) => {
                const pct = result.leadsNeeded > 0 ? Math.min((step.value / result.leadsNeeded) * 100, 100) : 0;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-right text-[11px] text-white/30">{step.label}</div>
                    <div className="flex-1 h-6 rounded-md bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-md bg-white/[0.15] transition-all duration-700"
                        style={{ width: i === 0 ? "100%" : `${pct}%`, opacity: 1 - i * 0.15 }} />
                    </div>
                    <div className="w-16 shrink-0 text-right text-xs font-bold text-white/60 tabular-nums">
                      {formatNumber(step.value)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-white/[0.06] pt-3 flex justify-between text-[11px]">
              <span className="text-white/25">Conversão geral do funil</span>
              <span className="font-bold text-white/60">
                {formatPercentage(result.leadsNeeded > 0 ? (result.salesNeeded / result.leadsNeeded) * 100 : 0)}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-sm leading-relaxed text-white/50">
              Para faturar{" "}
              <span className="font-bold text-white">{formatCurrency(inputs.targetRevenue)}</span>
              {" "}você precisa gerar{" "}
              <span className="font-bold text-white">{formatNumber(result.leadsNeeded)} leads</span>,
              {" "}investindo{" "}
              <span className="font-bold text-white">{formatCurrency(result.adBudgetNeeded)}</span>
              {" "}em anúncios, e realizar{" "}
              <span className="font-bold text-white">{formatNumber(result.callsNeeded)} calls</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}