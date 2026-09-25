import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getProduct, listTransactions } from "@/lib/inventory-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const product = await getProduct(params.id);
  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const transactions = await listTransactions(params.id);
  return NextResponse.json({ product, transactions });
}
