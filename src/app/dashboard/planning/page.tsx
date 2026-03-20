"use client";

import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import {
  Target,
  Users,
  PhoneCall,
  TrendingUp,
  DollarSign,
  Percent,
  Calculator,
  Info,
} from "lucide-react";
import {
  calculateReverseEngineering,
  formatCurrency,
  formatPercentage,
  formatNumber,
  ReverseEngineeringInputs,
} from "@/lib/metrics-service";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface SliderFieldProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  accentColor: string;
  icon: React.ReactNode;
}

function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  format,
  accentColor,
  icon,
}: SliderFieldProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            {icon}
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">{label}</span>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div
          className="rounded-lg px-3 py-1 text-sm font-bold tabular-nums"
          style={{
            backgroundColor: `${accentColor}15`,
            color: accentColor,
          }}
        >
          {format(value)}
        </div>
      </div>
      <div className="px-1">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="[&_[data-slot=slider-thumb]]:border-0"
          style={
            {
              "--slider-color": accentColor,
            } as React.CSSProperties
          }
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/50">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      </div>
    </div>
  );
}

interface ResultCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  accentColor: string;
  size?: "sm" | "md" | "lg";
}

function ResultCard({
  label,
  value,
  sublabel,
  icon,
  accentColor,
  size = "md",
}: ResultCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/8 bg-white/4 p-4",
        "transition-all duration-300 hover:border-white/15 hover:bg-white/6"
      )}
    >
      {/* Glow effect */}
      <div
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            {icon}
          </div>
        </div>
        <p
          className={cn(
            "mt-2 font-bold tabular-nums tracking-tight",
            size === "lg"
              ? "text-3xl"
              : size === "md"
              ? "text-2xl"
              : "text-xl"
          )}
          style={{ color: accentColor }}
        >
          {value}
        </p>
        {sublabel && (
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

// Funnel visualization
function FunnelStep({
  label,
  value,
  total,
  color,
  index,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  index: number;
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
        {label}
      </div>
      <div className="relative flex-1">
        <div className="h-7 overflow-hidden rounded-md bg-white/5">
          <div
            className="h-full rounded-md transition-all duration-700 ease-out"
            style={{
              width: index === 0 ? "100%" : `${pct}%`,
              backgroundColor: color,
              opacity: 1 - index * 0.15,
            }}
          />
        </div>
      </div>
      <div
        className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums"
        style={{ color }}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

const DEFAULT_INPUTS: ReverseEngineeringInputs = {
  targetRevenue: 30000,
  averageTicket: 997,
  conversionRate: 3,
  leadCost: 8,
  showRate: 60,
  closingRate: 30,
};

export default function PlanningPage() {
  const [inputs, setInputs] = useState<ReverseEngineeringInputs>(DEFAULT_INPUTS);

  const result = useMemo(() => calculateReverseEngineering(inputs), [inputs]);

  function update<K extends keyof ReverseEngineeringInputs>(
    key: K,
    value: ReverseEngineeringInputs[K]
  ) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const roiColor =
    result.roi >= 200
      ? "#00D861"
      : result.roi >= 100
      ? "#FAE125"
      : "#E85D22";

  const funnelSteps = [
    { label: "Leads", value: result.leadsNeeded, color: "#5050F2" },
    { label: "Prospects", value: result.prospectsNeeded, color: "#5050F2" },
    { label: "Calls", value: result.callsNeeded, color: "#FAE125" },
    { label: "Vendas", value: result.salesNeeded, color: "#00D861" },
  ];

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5050F2]/15">
            <Calculator className="h-5 w-5 text-[#5050F2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Engenharia Reversa
            </h1>
            <p className="text-sm text-muted-foreground">
              Calcule exatamente o que você precisa para bater sua meta
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── Inputs Column ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-white/8 bg-white/4 p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Seus Parâmetros
            </h2>

            <div className="space-y-7">
              <SliderField
                label="Meta de Receita"
                description="Faturamento bruto desejado"
                value={inputs.targetRevenue}
                min={1000}
                max={500000}
                step={1000}
                onChange={(v) => update("targetRevenue", v)}
                format={(v) => formatCurrency(v, "BRL")}
                accentColor="#00D861"
                icon={<Target className="h-3.5 w-3.5" />}
              />

              <SliderField
                label="Ticket Médio"
                description="Valor médio por venda"
                value={inputs.averageTicket}
                min={47}
                max={10000}
                step={50}
                onChange={(v) => update("averageTicket", v)}
                format={(v) => formatCurrency(v, "BRL")}
                accentColor="#FAE125"
                icon={<DollarSign className="h-3.5 w-3.5" />}
              />

              <SliderField
                label="Taxa de Conversão"
                description="Leads → Clientes"
                value={inputs.conversionRate}
                min={0.1}
                max={30}
                step={0.1}
                onChange={(v) => update("conversionRate", v)}
                format={(v) => formatPercentage(v)}
                accentColor="#5050F2"
                icon={<Percent className="h-3.5 w-3.5" />}
              />

              <SliderField
                label="Custo por Lead"
                description="Custo médio de aquisição de lead"
                value={inputs.leadCost}
                min={1}
                max={200}
                step={0.5}
                onChange={(v) => update("leadCost", v)}
                format={(v) => formatCurrency(v, "BRL")}
                accentColor="#E85D22"
                icon={<DollarSign className="h-3.5 w-3.5" />}
              />

              <SliderField
                label="Taxa de Comparecimento"
                description="% que aparecem na chamada"
                value={inputs.showRate}
                min={10}
                max={100}
                step={1}
                onChange={(v) => update("showRate", v)}
                format={(v) => formatPercentage(v)}
                accentColor="#FAE125"
                icon={<Users className="h-3.5 w-3.5" />}
              />

              <SliderField
                label="Taxa de Fechamento"
                description="% de calls que viram vendas"
                value={inputs.closingRate}
                min={1}
                max={100}
                step={1}
                onChange={(v) => update("closingRate", v)}
                format={(v) => formatPercentage(v)}
                accentColor="#00D861"
                icon={<PhoneCall className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {/* Info box */}
          <div className="flex gap-2 rounded-xl border border-[#5050F2]/20 bg-[#5050F2]/8 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5050F2]" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Os resultados são calculados em tempo real. Ajuste os sliders para
              simular diferentes cenários de lançamento.
            </p>
          </div>
        </div>

        {/* ── Results Column ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Main results grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ResultCard
              label="Leads Necessários"
              value={formatNumber(result.leadsNeeded)}
              sublabel={`a ${formatCurrency(inputs.leadCost)}/lead`}
              icon={<Users className="h-4 w-4" />}
              accentColor="#5050F2"
              size="lg"
            />
            <ResultCard
              label="Investimento Ads"
              value={formatCurrency(result.adBudgetNeeded)}
              sublabel="orçamento estimado"
              icon={<DollarSign className="h-4 w-4" />}
              accentColor="#E85D22"
            />
            <ResultCard
              label="Calls Necessárias"
              value={formatNumber(result.callsNeeded)}
              sublabel={`${formatPercentage(inputs.closingRate)} fechamento`}
              icon={<PhoneCall className="h-4 w-4" />}
              accentColor="#FAE125"
            />
            <ResultCard
              label="Vendas Esperadas"
              value={formatNumber(result.salesNeeded)}
              sublabel={`a ${formatCurrency(inputs.averageTicket)}`}
              icon={<Target className="h-4 w-4" />}
              accentColor="#00D861"
            />
            <ResultCard
              label="Lucro Estimado"
              value={formatCurrency(result.profitEstimate)}
              sublabel="receita − ads"
              icon={<TrendingUp className="h-4 w-4" />}
              accentColor="#00D861"
            />
            <ResultCard
              label="ROI"
              value={formatPercentage(result.roi)}
              sublabel="retorno sobre investimento"
              icon={<Percent className="h-4 w-4" />}
              accentColor={roiColor}
            />
          </div>

          {/* Funnel visualization */}
          <div className="rounded-xl border border-white/8 bg-white/4 p-5">
            <h2 className="mb-5 text-sm font-semibold text-foreground">
              Funil de Vendas
            </h2>
            <div className="space-y-3">
              {funnelSteps.map((step, i) => (
                <FunnelStep
                  key={step.label}
                  {...step}
                  total={result.leadsNeeded}
                  index={i}
                />
              ))}
            </div>
            <div className="mt-4 border-t border-white/8 pt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Conversão geral do funil</span>
                <span className="font-semibold text-[#00D861]">
                  {formatPercentage(
                    result.leadsNeeded > 0
                      ? (result.salesNeeded / result.leadsNeeded) * 100
                      : 0
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Summary strip */}
          <div className="rounded-xl border border-[#00D861]/20 bg-[#00D861]/6 p-5">
            <p className="text-sm leading-relaxed text-foreground">
              Para faturar{" "}
              <span className="font-bold text-[#00D861]">
                {formatCurrency(inputs.targetRevenue)}
              </span>{" "}
              você precisa gerar{" "}
              <span className="font-bold text-[#5050F2]">
                {formatNumber(result.leadsNeeded)} leads
              </span>
              , investindo{" "}
              <span className="font-bold text-[#E85D22]">
                {formatCurrency(result.adBudgetNeeded)}
              </span>{" "}
              em anúncios, e realizar{" "}
              <span className="font-bold text-[#FAE125]">
                {formatNumber(result.callsNeeded)} calls
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
