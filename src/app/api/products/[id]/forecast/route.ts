import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getForecastForProduct } from "@/lib/forecast-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const horizonParam = new URL(request.url).searchParams.get("horizonDays");
  const horizonDays = horizonParam ? Number(horizonParam) : undefined;

  const result = await getForecastForProduct(params.id, horizonDays);
  return NextResponse.json(result);
}
