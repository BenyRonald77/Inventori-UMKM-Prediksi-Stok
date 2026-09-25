"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { sku: "", name: "", category: "", unitPrice: "", reorderPoint: "", initialStock: "" };

export default function DashboardPage() {
  const { me, checking } = useAuthGuard();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    if (res.ok) setProducts((await res.json()).products);
  }, []);

  useEffect(() => {
    if (me) loadProducts();
  }, [me, loadProducts]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          category: form.category,
          unitPrice: Number(form.unitPrice),
          reorderPoint: Number(form.reorderPoint),
          initialStock: Number(form.initialStock || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah produk");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      await loadProducts();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <p className="p-10 text-center text-slate-500">Memuat...</p>;
  if (!me) return null;

  const lowStockCount = products.filter((p) => p.currentStock <= p.reorderPoint).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Nav />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">Daftar Produk</h1>
          {lowStockCount > 0 && (
            <p className="mt-1 text-sm text-amber-600">
              {lowStockCount} produk perlu segera di-restock.
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Batal" : "+ Tambah Produk"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-3"
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            SKU
            <input
              value={form.sku}
              onChange={(event) => setForm((f) => ({ ...f, sku: event.target.value }))}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Nama Produk
            <input
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Kategori
            <input
              value={form.category}
              onChange={(event) => setForm((f) => ({ ...f, category: event.target.value }))}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Harga Satuan
            <input
              type="number"
              min={0}
              value={form.unitPrice}
              onChange={(event) => setForm((f) => ({ ...f, unitPrice: event.target.value }))}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Titik Reorder
            <input
              type="number"
              min={0}
              value={form.reorderPoint}
              onChange={(event) => setForm((f) => ({ ...f, reorderPoint: event.target.value }))}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Stok Awal
            <input
              type="number"
              min={0}
              value={form.initialStock}
              onChange={(event) => setForm((f) => ({ ...f, initialStock: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-rose-600 sm:col-span-3">{error}</p>}
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "Menyimpan..." : "Simpan Produk"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Stok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isLow = product.currentStock <= product.reorderPoint;
              return (
                <tr key={product.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">{product.sku}</td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3">{formatRupiah(product.unitPrice)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isLow ? "bg-rose-100 text-rose-700" : "bg-brand-100 text-brand-700"
                      }`}
                    >
                      {product.currentStock} {isLow ? "· Stok Rendah" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/products/${product.id}`} className="text-brand-600 hover:underline">
                      Detail
                    </Link>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Belum ada produk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
