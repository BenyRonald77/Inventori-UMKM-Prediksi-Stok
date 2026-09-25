import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { StockTransactionType } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where: { email: "admin@umkm.test" },
    update: {},
    create: { name: "Admin Toko", email: "admin@umkm.test", passwordHash },
  });

  const products = [
    { sku: "BRG-001", name: "Beras 5kg", category: "Sembako", unitPrice: 65_000, reorderPoint: 20, baseDaily: 6 },
    { sku: "BRG-002", name: "Minyak Goreng 2L", category: "Sembako", unitPrice: 34_000, reorderPoint: 15, baseDaily: 4 },
    { sku: "BRG-003", name: "Gula Pasir 1kg", category: "Sembako", unitPrice: 16_000, reorderPoint: 25, baseDaily: 5 },
  ];

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {},
      create: {
        sku: item.sku,
        name: item.name,
        category: item.category,
        unitPrice: item.unitPrice,
        reorderPoint: item.reorderPoint,
        currentStock: 0,
      },
    });

    const existingTx = await prisma.stockTransaction.count({ where: { productId: product.id } });
    if (existingTx > 0) continue;

    const initialStock = item.baseDaily * 45;
    await prisma.stockTransaction.create({
      data: {
        productId: product.id,
        type: StockTransactionType.IN,
        quantity: initialStock,
        note: "Stok awal (seed)",
        createdAt: daysAgo(35),
      },
    });

    let stock = initialStock;
    for (let day = 30; day >= 1; day--) {
      // tren naik ringan + pola akhir pekan lebih ramai, pseudo-random deterministik
      const weekday = daysAgo(day).getDay();
      const weekendBoost = weekday === 0 || weekday === 6 ? 2 : 0;
      const trend = Math.floor((30 - day) / 10);
      const noise = (day * 7) % 3;
      const qty = Math.max(1, item.baseDaily + weekendBoost + trend + noise - 1);

      stock -= qty;
      await prisma.stockTransaction.create({
        data: {
          productId: product.id,
          type: StockTransactionType.OUT,
          quantity: qty,
          note: "Penjualan harian (seed)",
          createdAt: daysAgo(day),
        },
      });
    }

    await prisma.product.update({ where: { id: product.id }, data: { currentStock: stock } });
  }

  console.log("Seed selesai:");
  console.log("- Login admin: admin@umkm.test / admin123");
  console.log(`- ${products.length} produk dengan ~30 hari histori transaksi stok keluar`);
}

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(9, 0, 0, 0);
  return date;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
