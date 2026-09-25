"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ForecastPoint = { date: string; quantity: number };

type ForecastResponse = {
  history: ForecastPoint[];
  forecast:
    | { status: "ok"; predictions: ForecastPoint[]; method: string; totalHorizonNeed: number }
    | { status: "insufficient_data"; message: string }
    | { status: "unavailable"; message: string };
};

type ChartRow = { date: string; aktual?: number; prediksi?: number };

function formatDateLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function ForecastChart({ productId }: { productId: string }) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/products/${productId}/forecast?horizonDays=14`)
      .then((res) => res.json())
      .then((json: ForecastResponse) => {
        if (!cancelled) setData(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading) return <p className="text-sm text-slate-500">Memuat prediksi...</p>;
  if (!data) return <p className="text-sm text-rose-600">Gagal memuat data prediksi.</p>;

  if (data.forecast.status === "insufficient_data") {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
        {data.forecast.message}
      </div>
    );
  }

  if (data.forecast.status === "unavailable") {
    return (
      <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
        {data.forecast.message}
      </div>
    );
  }

  const recentHistory = data.history.slice(-21);
  const rows: ChartRow[] = [
    ...recentHistory.map((point) => ({ date: point.date, aktual: point.quantity })),
    ...data.forecast.predictions.map((point) => ({ date: point.date, prediksi: point.quantity })),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <p className="text-slate-500">
          Proyeksi kebutuhan 14 hari ke depan:{" "}
          <span className="font-semibold text-brand-700">
            {data.forecast.totalHorizonNeed} unit
          </span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip labelFormatter={formatDateLabel} />
          <Legend />
          <Line
            type="monotone"
            dataKey="aktual"
            name="Stok Keluar Aktual"
            stroke="#ea580c"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="prediksi"
            name="Prediksi"
            stroke="#0ea5e9"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
