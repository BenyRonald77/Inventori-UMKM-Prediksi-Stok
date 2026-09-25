import { prisma } from "@/lib/prisma";
import { StockTransactionType } from "@/lib/constants";

export class InventoryError extends Error {}

export async function listProducts() {
  return prisma.product.findMany({ orderBy: { name: "asc" } });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export async function listTransactions(productId: string, limit = 100) {
  return prisma.stockTransaction.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function createProduct(params: {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  reorderPoint: number;
  initialStock: number;
}) {
  const existing = await prisma.product.findUnique({ where: { sku: params.sku } });
  if (existing) throw new InventoryError("SKU sudah digunakan produk lain");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sku: params.sku,
        name: params.name,
        category: params.category,
        unitPrice: params.unitPrice,
        reorderPoint: params.reorderPoint,
        currentStock: params.initialStock,
      },
    });

    if (params.initialStock > 0) {
      await tx.stockTransaction.create({
        data: {
          productId: product.id,
          type: StockTransactionType.IN,
          quantity: params.initialStock,
          note: "Stok awal",
        },
      });
    }

    return product;
  });
}

export async function createTransaction(
  productId: string,
  params: { type: StockTransactionType; quantity: number; note?: string },
) {
  if (params.quantity <= 0) {
    throw new InventoryError("Jumlah harus lebih dari 0");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new InventoryError("Produk tidak ditemukan");

    if (params.type === StockTransactionType.OUT && params.quantity > product.currentStock) {
      throw new InventoryError("Stok tidak cukup untuk transaksi ini");
    }

    const nextStock =
      params.type === StockTransactionType.IN
        ? product.currentStock + params.quantity
        : product.currentStock - params.quantity;

    await tx.product.update({ where: { id: productId }, data: { currentStock: nextStock } });

    return tx.stockTransaction.create({
      data: {
        productId,
        type: params.type,
        quantity: params.quantity,
        note: params.note,
      },
    });
  });
}
