/**
 * Growfy LaunchOS — Kommo API Service
 * Cliente REST para a API v4 do Kommo.
 * Credenciais são por-workspace (subdomain + long-lived access token).
 */

import type { KommoLeadInput, KommoStageRef } from "./webhook-service";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface KommoCredentials {
  subdomain: string;   // ex: "growfy" → growfy.kommo.com
  accessToken: string; // long-lived token
}

export interface KommoPipelineStage {
  id: number;
  name: string;
  sort: number;
  is_editable?: boolean;
  pipeline_id?: number;
  type?: number; // 0 = regular, 1 = unsorted
  // stage.color etc — ignoramos
}

export interface KommoPipeline {
  id: number;
  name: string;
  sort: number;
  is_main?: boolean;
  _embedded?: {
    statuses?: KommoPipelineStage[];
  };
}

// Kommo response HAL envelope
interface KommoLeadsResponse {
  _page?: number;
  _links?: { next?: { href?: string }; last?: { href?: string } };
  _embedded?: { leads?: KommoLeadInput[] };
}

interface KommoPipelinesResponse {
  _embedded?: { pipelines?: KommoPipeline[] };
}

export interface KommoLossReason {
  id: number;
  name: string;
  sort?: number;
}

export interface KommoUser {
  id: number;
  name: string;
  email?: string;
}

interface KommoLossReasonsResponse {
  _embedded?: { loss_reasons?: KommoLossReason[] };
}

interface KommoUsersResponse {
  _embedded?: { users?: KommoUser[] };
}

// ─────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────

function baseUrl(creds: KommoCredentials): string {
  return `https://${creds.subdomain}.kommo.com/api/v4`;
}

async function kommoFetch<T>(
  creds: KommoCredentials,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${baseUrl(creds)}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  // Kommo devolve 204 quando não há mais resultados na paginação
  if (res.status === 204) return {} as T;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kommo API error: ${res.status} ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Pipelines / Stages
// ─────────────────────────────────────────────

export async function fetchKommoPipelines(
  creds: KommoCredentials
): Promise<KommoPipeline[]> {
  const res = await kommoFetch<KommoPipelinesResponse>(creds, "/leads/pipelines");
  return res._embedded?.pipelines ?? [];
}

export async function fetchKommoPipeline(
  creds: KommoCredentials,
  pipelineId: string | number
): Promise<KommoPipeline | null> {
  try {
    const p = await kommoFetch<KommoPipeline>(creds, `/leads/pipelines/${pipelineId}`);
    return p;
  } catch {
    return null;
  }
}

/**
 * Mapeia estágios do Kommo → shape que o funil consome.
 * Kommo tem convenção: status_id 142 = "Ganho" (won), 143 = "Perdido" (lost).
 */
export function toStageRefs(stages: KommoPipelineStage[]): KommoStageRef[] {
  return stages.map((s) => ({
    id: String(s.id),
    name: s.name,
    type: s.id === 142 ? "won" : s.id === 143 ? "lost" : "regular",
  }));
}

export function toStagesForWorkspace(
  stages: KommoPipelineStage[]
): Array<{ id: string; name: string; sort: number; type: "regular" | "won" | "lost" }> {
  return stages.map((s) => ({
    id: String(s.id),
    name: s.name,
    sort: s.sort ?? 0,
    type: s.id === 142 ? "won" : s.id === 143 ? "lost" : "regular",
  }));
}

// ─────────────────────────────────────────────
// Loss reasons / Users (metadados pra traduzir IDs em nomes na UI)
// ─────────────────────────────────────────────

export async function fetchKommoLossReasons(
  creds: KommoCredentials
): Promise<KommoLossReason[]> {
  const res = await kommoFetch<KommoLossReasonsResponse>(
    creds,
    "/leads/loss_reasons",
    { limit: "250" }
  );
  return res._embedded?.loss_reasons ?? [];
}

export async function fetchKommoUsers(creds: KommoCredentials): Promise<KommoUser[]> {
  const res = await kommoFetch<KommoUsersResponse>(creds, "/users", { limit: "250" });
  return res._embedded?.users ?? [];
}

// ─────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────

/**
 * Pega um único lead com contacts embutidos — usado no webhook pra enriquecer o payload magro.
 */
export async function fetchKommoLead(
  creds: KommoCredentials,
  leadId: string | number
): Promise<KommoLeadInput | null> {
  try {
    const lead = await kommoFetch<KommoLeadInput>(creds, `/leads/${leadId}`, {
      with: "contacts",
    });
    return lead;
  } catch (err) {
    console.warn(`[Kommo] Erro ao buscar lead ${leadId}:`, err);
    return null;
  }
}

/**
 * Paginação HAL do Kommo: segue _links.next.href até vir 204/vazio.
 * Rate limit oficial: 7 req/s. Usamos 300ms entre páginas pra folga.
 */
export async function fetchAllKommoLeads(
  creds: KommoCredentials,
  onProgress?: (current: number) => void,
  pipelineId?: string | number
): Promise<KommoLeadInput[]> {
  const all: KommoLeadInput[] = [];
  const seen = new Set<string>();

  const params: Record<string, string> = {
    with: "contacts",
    limit: "250",
    page: "1",
  };
  if (pipelineId) params["filter[pipeline_id]"] = String(pipelineId);

  let page = 1;
  while (true) {
    params.page = String(page);
    const res = await kommoFetch<KommoLeadsResponse>(creds, "/leads", params);
    const leads = res._embedded?.leads ?? [];
    if (leads.length === 0) break;

    for (const lead of leads) {
      const id = String(lead.id);
      if (id && !seen.has(id)) {
        seen.add(id);
        all.push(lead);
      }
    }

    onProgress?.(all.length);

    if (!res._links?.next) break;
    page++;
    await new Promise((r) => setTimeout(r, 300));
  }

  return all;
}
