import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { StockTransactionType } from "@/lib/constants";
import { createTransaction, InventoryError } from "@/lib/inventory-service";

const schema = z.object({
  type: z.enum([StockTransactionType.IN, StockTransactionType.OUT]),
  quantity: z.number().int().positive(),
  note: z.string().max(200).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data transaksi tidak valid" }, { status: 400 });
  }

  try {
    const transaction = await createTransaction(params.id, parsed.data);
    return NextResponse.json({ transaction });
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
