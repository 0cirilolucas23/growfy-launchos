import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsDashboard, getPresetDateRange } from "@/lib/meta-ads-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const until = searchParams.get("until");
    const preset = searchParams.get("preset") ?? "30d";

    const dateRange = since && until
      ? { since, until }
      : getPresetDateRange(preset);

    const data = await fetchMetaAdsDashboard(dateRange);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ [Meta Ads API]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}