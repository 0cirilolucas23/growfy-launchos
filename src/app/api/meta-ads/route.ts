import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsDashboard } from "@/lib/meta-ads-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "30");

    const data = await fetchMetaAdsDashboard(days);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ [Meta Ads API]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}