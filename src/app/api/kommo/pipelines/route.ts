/**
 * Growfy LaunchOS — Kommo Pipelines Sync
 * POST /api/kommo/pipelines   body: { workspaceId, pipelineId? }
 *
 * Busca as etapas do pipeline no Kommo e salva em workspaces/{id}.kommoStages.
 * Se pipelineId não vier, usa o primeiro pipeline "main" da conta.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  fetchKommoPipelines,
  fetchKommoPipeline,
  toStagesForWorkspace,
} from "@/lib/kommo-api-service";

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, pipelineId } = (await req.json()) as {
      workspaceId: string;
      pipelineId?: string;
    };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    const db = getAdminDb();
    const wsRef = db.collection("workspaces").doc(workspaceId);
    const wsDoc = await wsRef.get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
    }

    const wsData = wsDoc.data() as Record<string, unknown>;
    const subdomain = wsData.kommoSubdomain as string | undefined;
    const accessToken = wsData.kommoAccessToken as string | undefined;

    if (!subdomain || !accessToken) {
      return NextResponse.json(
        { error: "Configure subdomain e accessToken do Kommo antes de sincronizar" },
        { status: 400 }
      );
    }

    const creds = { subdomain, accessToken };

    let targetPipelineId = pipelineId;
    let stages: ReturnType<typeof toStagesForWorkspace> = [];
    let pipelineName = "";

    if (targetPipelineId) {
      const p = await fetchKommoPipeline(creds, targetPipelineId);
      if (!p) return NextResponse.json({ error: "Pipeline não encontrado no Kommo" }, { status: 404 });
      pipelineName = p.name;
      stages = toStagesForWorkspace(p._embedded?.statuses ?? []);
    } else {
      const pipelines = await fetchKommoPipelines(creds);
      if (pipelines.length === 0) {
        return NextResponse.json({ error: "Nenhum pipeline encontrado na conta" }, { status: 404 });
      }
      const main = pipelines.find((p) => p.is_main) ?? pipelines[0];
      targetPipelineId = String(main.id);
      pipelineName = main.name;
      stages = toStagesForWorkspace(main._embedded?.statuses ?? []);
    }

    await wsRef.update({
      kommoPipelineId: targetPipelineId,
      kommoStages: stages,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      pipelineId: targetPipelineId,
      pipelineName,
      stages,
      stagesCount: stages.length,
    });
  } catch (error) {
    console.error("❌ [Kommo Pipelines]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace obrigatório" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
    if (!wsDoc.exists) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });

    const data = wsDoc.data() as Record<string, unknown>;
    const subdomain = data.kommoSubdomain as string | undefined;
    const accessToken = data.kommoAccessToken as string | undefined;
    if (!subdomain || !accessToken) return NextResponse.json({ pipelines: [] });

    const pipelines = await fetchKommoPipelines({ subdomain, accessToken });
    return NextResponse.json({
      pipelines: pipelines.map((p) => ({
        id: String(p.id),
        name: p.name,
        is_main: p.is_main ?? false,
        stagesCount: p._embedded?.statuses?.length ?? 0,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 500 }
    );
  }
}
