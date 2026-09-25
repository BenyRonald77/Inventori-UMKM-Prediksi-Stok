import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { createProduct, InventoryError, listProducts } from "@/lib/inventory-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const products = await listProducts();
  return NextResponse.json({ products });
}

const schema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(150),
  category: z.string().min(1).max(60),
  unitPrice: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  initialStock: z.number().int().nonnegative().default(0),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data produk tidak valid" }, { status: 400 });
  }

  try {
    const product = await createProduct(parsed.data);
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
