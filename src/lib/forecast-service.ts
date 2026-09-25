import { prisma } from "@/lib/prisma";
import { StockTransactionType } from "@/lib/constants";

const MIN_DATA_POINTS = 7;

export type ForecastPoint = { date: string; quantity: number };

export type ForecastResult =
  | {
      status: "ok";
      predictions: ForecastPoint[];
      method: string;
      totalHorizonNeed: number;
      generatedAt: string;
      fromCache: boolean;
    }
  | { status: "insufficient_data"; message: string }
  | { status: "unavailable"; message: string };

function getDefaultHorizon(): number {
  return Number(process.env.FORECAST_HORIZON_DAYS ?? 14);
}

function getCacheTtlMs(): number {
  return Number(process.env.FORECAST_CACHE_MINUTES ?? 60) * 60 * 1000;
}

/** Kelompokkan transaksi stok keluar per tanggal (YYYY-MM-DD), dijumlahkan. */
export async function getDailyOutHistory(productId: string): Promise<ForecastPoint[]> {
  const transactions = await prisma.stockTransaction.findMany({
    where: { productId, type: StockTransactionType.OUT },
    orderBy: { createdAt: "asc" },
    select: { quantity: true, createdAt: true },
  });

  const byDate = new Map<string, number>();
  for (const tx of transactions) {
    const dateKey = tx.createdAt.toISOString().slice(0, 10);
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + tx.quantity);
  }

  return Array.from(byDate.entries())
    .map(([date, quantity]) => ({ date, quantity }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getForecastForProduct(
  productId: string,
  horizonDays: number = getDefaultHorizon(),
): Promise<ForecastResult> {
  const cached = await prisma.forecastCache.findUnique({
    where: { productId_horizonDays: { productId, horizonDays } },
  });

  if (cached && Date.now() - cached.generatedAt.getTime() < getCacheTtlMs()) {
    return {
      status: "ok",
      predictions: JSON.parse(cached.predictions),
      method: cached.method,
      totalHorizonNeed: JSON.parse(cached.predictions).reduce(
        (sum: number, p: ForecastPoint) => sum + p.quantity,
        0,
      ),
      generatedAt: cached.generatedAt.toISOString(),
      fromCache: true,
    };
  }

  const history = await getDailyOutHistory(productId);
  if (history.length < MIN_DATA_POINTS) {
    return {
      status: "insufficient_data",
      message: `Butuh minimal ${MIN_DATA_POINTS} hari data transaksi stok keluar, baru tersedia ${history.length} hari.`,
    };
  }

  const mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";

  let response: Response;
  try {
    response = await fetch(`${mlServiceUrl}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, history, horizon_days: horizonDays }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return {
      status: "unavailable",
      message: "Layanan prediksi (FastAPI) tidak dapat dihubungi. Fitur inventori lain tetap berjalan normal.",
    };
  }

  if (!response.ok) {
    return {
      status: "unavailable",
      message: "Layanan prediksi gagal memproses permintaan ini.",
    };
  }

  const data = await response.json();
  const predictions: ForecastPoint[] = data.predictions;

  await prisma.forecastCache.upsert({
    where: { productId_horizonDays: { productId, horizonDays } },
    update: {
      method: data.method,
      predictions: JSON.stringify(predictions),
      generatedAt: new Date(),
    },
    create: {
      productId,
      horizonDays,
      method: data.method,
      predictions: JSON.stringify(predictions),
    },
  });

  return {
    status: "ok",
    predictions,
    method: data.method,
    totalHorizonNeed: data.total_horizon_need,
    generatedAt: new Date().toISOString(),
    fromCache: false,
  };
}
