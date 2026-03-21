// ─────────────────────────────────────────────
// Channel Dashboard Types
// ─────────────────────────────────────────────

export interface ChannelKPIs {
  investimento: number;
  faturamentoTotal: number;
  vendasIngressos: number;
  vendasOrderbump: number;
  custoporCompra: number;
  lucro: number;
  progressoInvestimento: { atual: number; meta: number };
  progressoVendas: { atual: number; meta: number };
  taxaConversaoPV: number; // %
  sessoes: number;
  initiateCheckouts: number;
  roas: number;
}

export interface ChannelChartPoint {
  dia: string;
  faturamento: number;
  investimento: number;
  roas: number;
}

export interface UTMRow {
  nome: string;
  investimento: number;
  vendas: number;
  custoPorSessao: number;
  taxaGancho: number; // %
  ctr: number; // %
  custoporCompra: number;
  faturamento: number;
  lucro: number;
}

export type UTMDimension = "utm_content" | "utm_medium" | "utm_campaign" | "utm_term";

export interface ChannelData {
  kpis: ChannelKPIs;
  chartData: ChannelChartPoint[];
  utmTables: Partial<Record<UTMDimension, UTMRow[]>>;
}

// ─────────────────────────────────────────────
// Mock Data Generator
// ─────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generateUTMRows(names: string[], baseInvestimento: number): UTMRow[] {
  return names.map((nome) => {
    const investimento = randomBetween(baseInvestimento * 0.1, baseInvestimento * 0.4);
    const vendas = Math.floor(randomBetween(2, 25));
    const faturamento = vendas * randomBetween(297, 997);
    return {
      nome,
      investimento,
      vendas,
      custoPorSessao: randomBetween(0.8, 4.5),
      taxaGancho: randomBetween(15, 65),
      ctr: randomBetween(0.8, 4.2),
      custoporCompra: investimento / Math.max(vendas, 1),
      faturamento,
      lucro: faturamento - investimento,
    };
  });
}

export function generateMockChannelData(
  channel: "meta" | "google",
  days = 14
): ChannelData {
  const investimentoTotal = channel === "meta"
    ? randomBetween(8000, 18000)
    : randomBetween(3000, 9000);

  const vendasIngressos = Math.floor(randomBetween(30, 120));
  const vendasOrderbump = Math.floor(vendasIngressos * randomBetween(0.2, 0.5));
  const faturamento = vendasIngressos * randomBetween(297, 997);
  const lucro = faturamento - investimentoTotal;

  const kpis: ChannelKPIs = {
    investimento: investimentoTotal,
    faturamentoTotal: faturamento,
    vendasIngressos,
    vendasOrderbump,
    custoporCompra: investimentoTotal / Math.max(vendasIngressos, 1),
    lucro,
    progressoInvestimento: { atual: investimentoTotal, meta: 20000 },
    progressoVendas: { atual: faturamento, meta: 50000 },
    taxaConversaoPV: randomBetween(1.5, 6),
    sessoes: Math.floor(randomBetween(3000, 15000)),
    initiateCheckouts: Math.floor(randomBetween(200, 800)),
    roas: faturamento / Math.max(investimentoTotal, 1),
  };

  // Chart data
  const now = new Date();
  const chartData: ChannelChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const inv = randomBetween(investimentoTotal / days * 0.5, investimentoTotal / days * 1.5);
    const fat = randomBetween(faturamento / days * 0.5, faturamento / days * 1.5);
    chartData.push({
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      faturamento: fat,
      investimento: inv,
      roas: fat / Math.max(inv, 1),
    });
  }

  // UTM tables
  const contentNames = channel === "meta"
    ? ["VSL_30s_Prova", "VSL_60s_Dor", "Carrossel_Depo", "Imagem_Hook1", "Reels_Bastidor"]
    : ["Anuncio_Display_A", "Anuncio_Search_B", "Responsivo_C", "Video_Bumper_D"];

  const mediumNames = channel === "meta"
    ? ["interest_frio", "lookalike_1p", "remarketing_ic", "broad_advantage"]
    : ["cpc", "display", "video", "discovery"];

  const campaignNames = channel === "meta"
    ? ["CPM_Prospeccao_Jul", "CPC_Retargeting_Jul", "Advantage+_Vendas"]
    : ["Search_Branded", "Search_Concorrente", "Display_Retargeting", "Video_Awareness"];

  const utmTables: Partial<Record<UTMDimension, UTMRow[]>> = {
    utm_content: generateUTMRows(contentNames, investimentoTotal),
    utm_medium: generateUTMRows(mediumNames, investimentoTotal),
    utm_campaign: generateUTMRows(campaignNames, investimentoTotal),
  };

  if (channel === "google") {
    const termNames = ["comprar curso online", "mentoria marketing digital", "lançamento produto digital", "curso trafego pago"];
    utmTables.utm_term = generateUTMRows(termNames, investimentoTotal);
  }

  return { kpis, chartData, utmTables };
}