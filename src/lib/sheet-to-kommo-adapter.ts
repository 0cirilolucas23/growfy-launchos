/**
 * Growfy LaunchOS — Sheet Row → NormalizedWebhookEvent
 *
 * Lê planilha do Google (aba "Kommo_Leads") por HEADER (linha 1), tolerante a
 * variações no nome da coluna. Cada linha vira um NormalizedWebhookEvent
 * pronto pra processWebhookEvent — sem depender de workspace.kommoStages
 * (a coluna `resultado` diz direto se é ganho/perdido/aberto).
 *
 * Header esperado (case-insensitive, sem acento):
 *   lead_id, nome, pipeline, etapa, status_anterior, responsavel, valor,
 *   origem, contato_nome, contato_telefone, contato_email, tags,
 *   tipo_evento, criado_em, atualizado_em, resultado
 *
 * Aliases aceitos (padrão inglês também funciona):
 *   lead_id ← id
 *   nome ← lead_name | name
 *   valor ← price
 *   responsavel ← responsible | responsible_user_id
 *   criado_em ← created_at
 *   atualizado_em ← updated_at
 *   contato_email ← contact_email | email
 *   ...
 */
import type { NormalizedWebhookEvent } from "./webhook-service";

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos combinantes
    .trim();
}

const HEADER_ALIASES: Record<string, string[]> = {
  lead_id: ["lead_id", "id", "leadid"],
  nome: ["nome", "lead_name", "name", "titulo", "title"],
  pipeline: ["pipeline", "funil", "pipeline_name", "pipeline_id"],
  etapa: ["etapa", "stage", "stage_name", "status", "status_id"],
  status_anterior: ["status_anterior", "previous_status", "etapa_anterior"],
  responsavel: ["responsavel", "responsible", "responsible_user_id", "vendedor", "owner"],
  valor: ["valor", "price", "amount"],
  origem: ["origem", "source", "utm_source"],
  contato_nome: ["contato_nome", "contact_name", "nome_contato"],
  contato_telefone: ["contato_telefone", "contact_phone", "telefone", "phone"],
  contato_email: ["contato_email", "contact_email", "email"],
  tags: ["tags"],
  tipo_evento: ["tipo_evento", "event_type", "evento"],
  criado_em: ["criado_em", "created_at", "data_criacao"],
  atualizado_em: ["atualizado_em", "updated_at", "data_atualizacao"],
  resultado: ["resultado", "outcome", "result", "status_final"],
};

type LogicalCol = keyof typeof HEADER_ALIASES;

export function buildHeaderIndex(headerRow: string[]): Record<LogicalCol, number> {
  const normalized = headerRow.map(normalizeHeader);
  const index = {} as Record<LogicalCol, number>;
  (Object.keys(HEADER_ALIASES) as LogicalCol[]).forEach((logical) => {
    const idx = normalized.findIndex((h) => HEADER_ALIASES[logical].includes(h));
    index[logical] = idx;
  });
  return index;
}

function getCell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  const v = row[idx];
  return v == null ? "" : String(v).trim();
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

function parseAmount(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeResultado(value: string): "aberto" | "ganho" | "perdido" {
  const v = normalizeHeader(value);
  if (["ganho", "won", "ganha", "ganhou"].includes(v)) return "ganho";
  if (["perdido", "lost", "perdida", "perdeu"].includes(v)) return "perdido";
  return "aberto";
}

/**
 * Fallback: quando a coluna `resultado` está vazia, inferimos pelo nome da
 * etapa. Cobre padrões típicos do Kommo em pt-br e en.
 *   "Fechado - ganho" / "Sale won" → ganho
 *   "Fechado - perdido" / "Sale lost" / "Descartado" → perdido
 *   qualquer outro → aberto
 */
function inferResultadoFromEtapa(etapa: string): "aberto" | "ganho" | "perdido" {
  const v = normalizeHeader(etapa);
  if (!v) return "aberto";
  if (/(ganh|won|convert|conclu[ií]d|fechad[ao].*ganh)/i.test(v)) return "ganho";
  if (/(perd|lost|descart|cancelad|nao.*converteu)/i.test(v)) return "perdido";
  return "aberto";
}

export interface SheetAdapterResult {
  event: NormalizedWebhookEvent;
  updatedAtIso: string;
}

/**
 * Converte uma linha em NormalizedWebhookEvent pronto pra persistir.
 * Retorna null se lead_id vazio (linha em branco).
 */
export function rowToEvent(
  row: string[],
  headerIdx: Record<LogicalCol, number>,
  workspaceId: string
): SheetAdapterResult | null {
  const leadId = getCell(row, headerIdx.lead_id);
  if (!leadId) return null;

  const etapaNome = getCell(row, headerIdx.etapa);
  const resultadoRaw = getCell(row, headerIdx.resultado);
  const resultado = resultadoRaw
    ? normalizeResultado(resultadoRaw)
    : inferResultadoFromEtapa(etapaNome);
  const status: NormalizedWebhookEvent["status"] =
    resultado === "ganho" ? "approved" : resultado === "perdido" ? "failed" : "pending";
  const type: NormalizedWebhookEvent["type"] =
    resultado === "ganho" || resultado === "perdido" ? "purchase" : "lead";

  const createdAt = parseDate(getCell(row, headerIdx.criado_em));
  const updatedAtStr = getCell(row, headerIdx.atualizado_em);
  const updatedAt = parseDate(updatedAtStr) ?? createdAt ?? new Date();

  const contactEmail = getCell(row, headerIdx.contato_email);
  const contactName = getCell(row, headerIdx.contato_nome);
  const contactPhone = getCell(row, headerIdx.contato_telefone);
  const customerId = contactEmail || `kommo_${leadId}`;

  const pipelineNome = getCell(row, headerIdx.pipeline);
  const responsavelNome = getCell(row, headerIdx.responsavel);

  const event: NormalizedWebhookEvent = {
    id: `kommo_${leadId}`,
    workspaceId,
    source: "kommo",
    type,
    status,
    amount: parseAmount(getCell(row, headerIdx.valor)),
    currency: "BRL",
    customerId,
    customerName: contactName || getCell(row, headerIdx.nome),
    customerEmail: contactEmail,
    customerPhone: contactPhone,
    productId: pipelineNome,
    productName: etapaNome,
    transactionId: leadId,
    timestamp: updatedAt,
    utmSource: getCell(row, headerIdx.origem) || undefined,
    pipelineId: pipelineNome,
    stageId: etapaNome,
    stageName: etapaNome,
    responsibleUserId: responsavelNome || undefined,
    raw: {
      source: "sheet",
      row_values: row,
      pipeline: pipelineNome,
      etapa: etapaNome,
      status_anterior: getCell(row, headerIdx.status_anterior),
      responsavel: responsavelNome,
      origem: getCell(row, headerIdx.origem),
      tags: getCell(row, headerIdx.tags),
      tipo_evento: getCell(row, headerIdx.tipo_evento),
      resultado,
    },
  };

  return { event, updatedAtIso: updatedAtStr };
}
