# Spec — Integração Kommo + Meta Ads + Funil de Leads por Etapa

**Contexto:** Growfy LaunchOS já suporta Kiwify (venda de infoproduto) + Meta Ads.
Este spec adiciona suporte a um segundo "tipo" de cliente — venda via CRM/lead
(começando por Kommo) — mantendo os dois modelos coexistindo por workspace.

---

## 0. Decisão de arquitetura (resumo)

- `platforms` continua **array** (não vira campo singular). Kommo é só mais um item.
- Cada workspace já é isolado por `workspaceId`; funil por etapa **não exige** mudança
  de controle de acesso — reaproveita o filtro existente.
- Gravação do Kommo segue o **mesmo padrão de ID determinístico** do Kiwify
  (`doc(kommo_${leadId})`), o que faz o doc já representar o **estado atual** do lead
  (não um log de eventos). Isso é o que permite o funil por etapa sem lógica de dedup.
- **Escopo desta entrega: sem receita.** Verificado com dados reais que o cliente não
  preenche `price` nos leads ganhos (não é split — é ausência de dado). A integração
  entrega leads + funil por etapa; receita fica pendente de processo do cliente (ver
  item 4).

---

## 1. Corrigir antes de crescer: `WebhookSource` duplicado

`metrics-service.ts` define seu próprio `WebhookSource` (`"hotmart" | "eduzz" | "kiwify" | "meta_ads" | "manual"`),
diferente do `WebhookSource` em `webhook-service.ts` (`:14`). São dois tipos com o mesmo nome,
desincronizados.

**Ação:** criar `src/lib/types.ts` (ou `src/types/events.ts`) com um único `WebhookSource`
e um único `WebhookEventType`, exportados e importados nos dois arquivos. Adicionar `"kommo"`
só neste lugar central.

```ts
// src/lib/types.ts
export type WebhookSource =
  | "hotmart" | "eduzz" | "kiwify" | "kommo" | "meta_ads" | "manual";

export type WebhookEventType =
  | "purchase" | "refund"
  | "subscription_start" | "subscription_cancel" | "subscription_renewal"
  | "lead" | "click";
```

---

## 2. `NormalizedWebhookEvent` — novos campos (opcionais, só usados por CRM)

`type` e `status` do evento do Kommo — **decisão revisada** (ver seção 4):
verificação em dados reais mostrou que os leads "Ganho" desse cliente não têm
`price` preenchido (nem no campo nativo, nem em custom field). Não é problema
de split — é lacuna de processo do time de vendas do cliente. Por isso, **a
integração inicial não carrega receita nenhuma**:

```ts
export interface NormalizedWebhookEvent {
  // ...campos existentes
  type: "lead";           // todo evento do Kommo é "lead" por enquanto,
                           // independente da etapa (não vira "purchase")
  amount: 0;               // sempre zero — não há dado de valor pra usar
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  raw?: Record<string, unknown>;
}
```

Isso significa: `aggregateRevenue()` e `calculateConversionMetrics()` continuam
funcionando sem alteração nenhuma (o Kommo simplesmente não contribui com
receita nem com contagem de "customers"/"prospects" por enquanto) — o único
consumidor real dos eventos do Kommo hoje é o `buildPipelineFunnel()` (seção 7),
que agrupa por `stageId`, não por `type`.

**Quando o cliente resolver o processo de preencher `price`:** revisitar este
item pra decidir se "Ganho" passa a virar `type: "purchase"` com `amount` real.
Não implementar essa parte agora.

---

## 3. Schema do `Workspace` — novos campos

`workspace-service.ts`:

```ts
// :41 — estender união existente
type WorkspacePlatform = {
  name: "hotmart" | "eduzz" | "kiwify" | "kommo";
  enabled: boolean;
  webhookSecret?: string;
};

// campos novos no root do Workspace (mesmo padrão flat já usado p/ metaAdAccountId)
kommoSubdomain?: string;      // ex: "growfy" → growfy.kommo.com
kommoAccessToken?: string;    // long-lived token
kommoPipelineId?: string;     // funil usado por esse cliente
kommoStages?: {
  id: string;
  name: string;
  sort: number;
  type: "regular" | "won" | "lost";
}[];
```

`kommoStages` é buscado **uma vez** via `GET /api/v4/leads/pipelines/{id}` e cacheado
no workspace (botão "Sincronizar funil" nas Configurações) — não é buscado a cada
carregamento do dashboard.

**Default no `createWorkspace()`:** adicionar `{ name: "kommo", enabled: false }` ao
array padrão — desabilitado, pra não confundir clientes que não usam CRM.

---

## 4. ✅ RESOLVIDO — verificação feita com dados reais (curl direto na API do Kommo)

Testado em produção (leads reais com `status_id: 142`, `pipeline_id: 14123687`,
`closed_at` preenchido — fechamentos reais, não amostra aleatória):

- `price: 0` e `custom_fields_values: null` em **todos** os leads ganhos verificados.
- **Não é split/comissão** — é ausência total de dado. O time de vendas do cliente
  não preenche valor nenhum ao mover lead pra "Ganho", nem no campo nativo nem
  em custom field.

**Decisão:** a integração é construída **sem receita** por enquanto (ver seção 2,
revisada). `buildPipelineFunnel()` e contagem de leads por etapa funcionam
normalmente — é o objetivo desta primeira entrega. Receita fica pendente de o
cliente ajustar o processo de preenchimento no Kommo; não é bloqueio técnico.

---

## 5. Rota de webhook — seguir o padrão existente (não generalizar ainda)

Criar `src/app/api/webhooks/kommo/route.ts`, espelhando a estrutura do
`webhooks/kiwify/route.ts` (query param `?workspace=`, valida assinatura se o Kommo
oferecer, chama `normalizeKommo()`, chama `processWebhookEvent()`).

**Diferença importante em relação ao Kiwify:** o payload do Kommo é magro (só IDs).
`normalizeKommo()` provavelmente precisa de uma chamada de enriquecimento:

```
webhook recebido (leadId, statusId, pipelineId)
  → GET /api/v4/leads/{leadId}?with=contacts  (nome, email do contato)
  → resolver stageName a partir de workspace.kommoStages (sem nova chamada à API)
  → montar NormalizedWebhookEvent
  → processWebhookEvent(event)
```

*Nota:* não vale a pena generalizar para uma rota dinâmica `[provider]/route.ts` agora
— o ganho de escala só compensa a partir do 3º provider de CRM. Documentar a ideia
mas não implementar ainda.

---

## 6. Import histórico do Kommo (opcional, mas recomendado)

Espelhar `import/kiwify/route.ts` + `kiwify-api-service.ts`:
- Paginação pela API do Kommo (`GET /api/v4/leads?page=&limit=250`)
- ID determinístico: `doc(kommo_${leadId})`
- Mesma lógica de dedup por `doc.get().exists`

---

## 7. Nova função pura de agregação — `buildPipelineFunnel`

Em `metrics-service.ts` (não em `webhook-service.ts` — esse é só I/O):

```ts
export interface FunnelStage {
  stageId: string;
  stageName: string;
  count: number;
}

export function buildPipelineFunnel(
  events: WebhookEvent[],              // já filtrados por source === "kommo"
  stages: { id: string; name: string; sort: number }[]
): FunnelStage[] {
  const counts = new Map<string, number>();
  events.forEach((e) => {
    const stageId = (e.raw as any)?.stageId as string | undefined;
    if (stageId) counts.set(stageId, (counts.get(stageId) ?? 0) + 1);
  });
  return [...stages]
    .sort((a, b) => a.sort - b.sort)
    .map((s) => ({ stageId: s.id, stageName: s.name, count: counts.get(s.id) ?? 0 }));
}
```

**Importante:** cada doc em `webhook_events` já representa o estado atual do lead
(ID determinístico `kommo_${leadId}`), então **não é necessário** agrupar por
`customerId` e pegar o último evento — o count por `stageId` já está correto direto
dos docs.

Uso no hook:
```ts
const kommoEvents = allEvents.filter(e => e.source === "kommo");
const funnel = buildPipelineFunnel(kommoEvents, workspace.kommoStages ?? []);
```

---

## 8. Sidebar — visibilidade condicional por integração

`sidebar.tsx` hoje só filtra por `adminOnly`. Estender:

```ts
const hasLeadPlatform = activeWorkspace?.platforms?.some(
  (p) => p.name === "kommo" && p.enabled
);

// item novo
{ href: "/dashboard/funil", label: "Funil de Leads", icon: GitBranch, adminOnly: false, requires: "leadPlatform" as const },
```

```ts
.filter((item) =>
  (!item.adminOnly || isAdmin) &&
  (!("requires" in item) || (item.requires === "leadPlatform" && hasLeadPlatform))
)
```

---

## 9. Onboarding / Configurações

`createWorkspace()` hoje só recebe nome. Estender o formulário (mesmo componente
serve para criação e para "Configurações → Ferramenta de Eventos" depois):

```
Passo 1 (existe): Nome do cliente
Passo 2 (novo): Toggles por plataforma
   [ ] Kiwify   [ ] Hotmart   [ ] Eduzz   [ ] Kommo
   → se Kommo marcado: subdomain, access token, botão "Sincronizar funil"
     (chama pipelines, preenche kommoStages, salva kommoPipelineId)
Passo 3 (existe): Meta Ads (token + ad account id)
```

---

## 10.5 UTM não capturado no Kommo — reconciliação na página Meta Ads

**Confirmado com o cliente:** o Kommo desse workspace **não vai capturar UTM**
(nem hoje, nem planejado). Isso tem impacto direto na página Meta Ads, mas não
na Visão Geral.

**Não afeta:** ROAS/CPA de conta (Visão Geral) — `aggregateRevenue()` soma todo
`type: "purchase" && status: "success"` do workspace inteiro, sem depender de UTM.
Receita do Kommo entra na conta normalmente.

**Afeta (em cenário geral):** a tabela detalhada da página Meta Ads (por
campanha/público/criativo), que cruza gasto por campanha (Meta API) com receita
**por `utmCampaign`** dos eventos. Sem UTM, os eventos do Kommo não casam com
nenhuma campanha — simplesmente não aparecem em nenhuma linha.

**Caso específico deste cliente — 1 única campanha ativa:** isso elimina a
ambiguidade sem precisar de UTM. Com 1 campanha só, 100% da receita do workspace
pode ser atribuída a ela diretamente (não tem outra campanha concorrendo pela
atribuição). A regra deve ser **dinâmica**, calculada contra a contagem real de
campanhas ativas retornada pela Meta API — não hardcoded pra este cliente:

```ts
const campanhasAtivas = await fetchActiveCampaigns(workspace.metaAdAccountId);

if (campanhasAtivas.length === 1) {
  // Atribui 100% da receita do workspace à campanha única.
  // Não precisa de utm_campaign — não há outra campanha pra "vazar".
  const linhaUnica = {
    campaignId: campanhasAtivas[0].id,
    campaignName: campanhasAtivas[0].name,
    revenue: totalRevenueDoWorkspaceNoPeríodo,
    spend: campanhasAtivas[0].spend,
  };
} else {
  // Precisa de utm_campaign pra desambiguar entre múltiplas campanhas
  // + linha de reconciliação "Não atribuído / Outras fontes":
  // soma de receita do workspace que não casou com nenhuma campanha ativa
}
```

Isso garante `soma(linhas da tabela) === faturamento total da Visão Geral`
tanto no cenário de hoje (1 campanha) quanto se esse cliente — ou outro —
crescer pra múltiplas campanhas no futuro. É a razão de calcular por contagem
real de campanhas em vez de assumir "esse cliente nunca vai crescer".

**Não implementar:** mapeamento de custom field pra UTM no Kommo (não se aplica
a esse cliente, e com 1 campanha ativa não seria necessário de qualquer forma).

---

## 10. Ordem de implementação sugerida

1. Consolidar `WebhookSource`/`WebhookEventType` em arquivo único (item 1) — evita retrabalho
2. Verificar origem real do valor da venda no Kommo (item 4) — antes de codar o normalizer
3. `normalizeKommo()` + rota de webhook (item 5)
4. Estender schema do `Workspace` + default do `createWorkspace()` (item 3)
5. `buildPipelineFunnel()` em `metrics-service.ts` (item 7)
6. Sidebar condicional (item 8)
7. Onboarding/Configurações (item 9)
8. Ler `dashboard/meta-ads/page.tsx` e adicionar linha "Não atribuído / Outras fontes" (item 10.5)
9. Import histórico (item 6) — pode ficar por último, é o menos urgente