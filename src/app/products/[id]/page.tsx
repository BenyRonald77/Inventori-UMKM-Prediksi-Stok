"use client";

import { useCallback, useEffect, useState } from "react";
import { ForecastChart } from "@/components/forecast-chart";
import { Nav } from "@/components/nav";
import { useAuthGuard } from "@/lib/use-auth-guard";

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  currentStock: number;
  reorderPoint: number;
};

type Transaction = {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  note: string | null;
  createdAt: string;
};

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { me, checking } = useAuthGuard();
  const [product, setProduct] = useState<Product | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/products/${params.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setProduct(data.product);
    setTransactions(data.transactions);
  }, [params.id]);

  useEffect(() => {
    if (me) loadData();
  }, [me, loadData]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${params.id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantity: Number(quantity), note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mencatat transaksi");
        return;
      }
      setQuantity("");
      setNote("");
      await loadData();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <p className="p-10 text-center text-slate-500">Memuat...</p>;
  if (!me) return null;
  if (!product) return <p className="p-10 text-center text-slate-500">Memuat produk...</p>;

  const isLow = product.currentStock <= product.reorderPoint;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Nav />

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">{product.sku} · {product.category}</p>
        <h1 className="text-2xl font-bold text-brand-700">{product.name}</h1>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Harga</p>
            <p className="font-semibold">{formatRupiah(product.unitPrice)}</p>
          </div>
          <div>
            <p className="text-slate-500">Stok Saat Ini</p>
            <p className={`font-semibold ${isLow ? "text-rose-600" : "text-slate-800"}`}>
              {product.currentStock} {isLow && "(Rendah)"}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Titik Reorder</p>
            <p className="font-semibold">{product.reorderPoint}</p>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Prediksi Kebutuhan Stok</h2>
        <ForecastChart productId={product.id} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Jenis
          <select
            value={type}
            onChange={(event) => setType(event.target.value as "IN" | "OUT")}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="OUT">Stok Keluar</option>
            <option value="IN">Stok Masuk</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Jumlah
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Catatan (opsional)
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-rose-600 sm:col-span-4">{error}</p>}
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : "Catat Transaksi"}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-800">
          Riwayat Transaksi
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Jumlah</th>
              <th className="px-4 py-3">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{formatDateTime(tx.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tx.type === "IN" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tx.type === "IN" ? "Masuk" : "Keluar"}
                  </span>
                </td>
                <td className="px-4 py-3">{tx.quantity}</td>
                <td className="px-4 py-3 text-slate-500">{tx.note ?? "—"}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Belum ada transaksi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
