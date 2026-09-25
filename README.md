# Inventori UMKM + Prediksi Stok

Aplikasi inventori untuk UMKM: kelola produk & transaksi stok masuk/keluar,
dilengkapi **prediksi kebutuhan stok** dari layanan machine learning terpisah
(FastAPI) yang dipanggil oleh aplikasi Next.js.

Lihat dokumen perencanaan lengkap di [`docs/PRD.md`](./docs/PRD.md).

## Arsitektur

```
┌─────────────────────┐        HTTP (POST /forecast)        ┌───────────────────────┐
│   Next.js (web)      │ ───────────────────────────────────▶│  FastAPI (ml-service)  │
│  - Dashboard & CRUD   │◀─────────────────────────────────── │  - Model forecasting   │
│  - Prisma + SQLite/PG │        { predictions: [...] }        │  - numpy/pandas        │
└─────────────────────┘                                       └───────────────────────┘
```

- **`/`** (root repo) — aplikasi utama Next.js (frontend + backend + database).
- **`/ml-service`** — layanan Python FastAPI mandiri yang menghitung proyeksi
  kebutuhan stok, berjalan sebagai proses/port terpisah.

## Fitur Utama

- **CRUD produk** — SKU, nama, kategori, harga, titik reorder.
- **Transaksi stok masuk/keluar** — `currentStock` produk ter-update otomatis & atomik setiap transaksi.
- **Peringatan stok rendah** — produk dengan stok ≤ titik reorder ditandai di dashboard.
- **Prediksi kebutuhan stok** — grafik histori vs. proyeksi 14 hari ke depan di halaman detail produk, dihitung oleh layanan FastAPI (tren linear + rata-rata bergerak + musiman hari-dalam-minggu) dan di-cache agar efisien.
- **Graceful fallback** — bila layanan FastAPI tidak aktif, dashboard tetap berfungsi normal; hanya bagian prediksi yang menampilkan pesan "tidak tersedia".

## Menjalankan Secara Lokal

### 1. Aplikasi Next.js

```bash
npm install
cp .env.example .env
npm run prisma:migrate   # migrasi + seed (3 produk, ~30 hari histori transaksi)
npm run dev
```

Buka `http://localhost:3000/login` — akun demo: `admin@umkm.test` / `admin123`.

### 2. Layanan FastAPI (ml-service)

Di terminal terpisah:

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Layanan berjalan di `http://localhost:8000` (cek `GET /health`, dokumentasi
interaktif otomatis di `/docs`). Pastikan `ML_SERVICE_URL` di `.env` aplikasi
Next.js mengarah ke URL ini (default sudah cocok untuk development lokal).

Kedua proses (Next.js & FastAPI) perlu berjalan bersamaan agar fitur prediksi
berfungsi — aplikasi utama tetap bisa dipakai (CRUD produk & transaksi) tanpa
FastAPI aktif, hanya fitur prediksi yang tidak tersedia.

## Model Prediksi Stok

Model sengaja dibuat **sederhana & transparan** (bukan black-box) agar mudah
dijelaskan ke pengguna UMKM non-teknis:

1. Susun histori transaksi stok keluar harian sebuah produk sebagai deret waktu.
2. Hitung tren (regresi linear) atas seluruh histori.
3. Hitung rata-rata bergerak 7 hari terakhir sebagai penstabil.
4. Campurkan tren & rata-rata bergerak (60:40), lalu kalikan faktor musiman
   hari-dalam-minggu (mis. akhir pekan biasanya lebih ramai).
5. Hasil akhir: proyeksi kebutuhan stok per hari untuk N hari ke depan (default 14).

Prediksi hanya dihitung bila tersedia minimal **7 hari** data transaksi stok
keluar; bila belum cukup, sistem menampilkan pesan eksplisit alih-alih
memaksakan proyeksi yang tidak reliabel. Lihat implementasinya di
[`ml-service/forecasting.py`](./ml-service/forecasting.py).

## Struktur Proyek

```
docs/PRD.md                             Dokumen PRD
prisma/schema.prisma                    Skema database (produk, transaksi, cache prediksi)
prisma/seed.ts                           Data contoh + histori transaksi 30 hari
src/lib/inventory-service.ts             Logika CRUD produk & transaksi stok
src/lib/forecast-service.ts              Pemanggil FastAPI + cache hasil prediksi
src/components/forecast-chart.tsx        Grafik histori vs prediksi (Recharts)
src/app/dashboard, src/app/products      UI dashboard & detail produk
src/app/api                              API routes Next.js
ml-service/main.py                       Entry point FastAPI
ml-service/forecasting.py                Model forecasting (tren + moving average)
```

## Skrip yang Tersedia

| Skrip | Keterangan |
|---|---|
| `npm run dev` | Jalankan Next.js development |
| `npm run build` / `npm start` | Build & jalankan production |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run prisma:migrate` | Migrasi database (development) |
| `npm run prisma:seed` | Jalankan seed data contoh |

## Deployment

1. **Next.js**: set `DATABASE_URL` (disarankan PostgreSQL untuk production —
   ubah `provider` di `prisma/schema.prisma`), `JWT_SECRET`, dan
   `ML_SERVICE_URL` mengarah ke URL production layanan FastAPI. Build:
   `npm run build`, jalankan: `npm start`.
2. **ml-service**: deploy sebagai service Python terpisah (mis. container
   Docker, Railway, Render, atau VM biasa) menjalankan
   `uvicorn main:app --host 0.0.0.0 --port 8000`. Set `ALLOWED_ORIGINS` ke
   domain production aplikasi Next.js agar CORS mengizinkan pemanggilan.
3. Kedua layanan dapat di-scale/dikelola secara independen karena
   berkomunikasi murni lewat HTTP.

## Catatan Keamanan

- Password admin di-hash dengan bcrypt.
- Semua endpoint produk/transaksi/prediksi memerlukan sesi login (JWT cookie httpOnly).
- Update `currentStock` & pencatatan transaksi dilakukan dalam satu transaksi
  database (atomik) untuk mencegah data tidak konsisten.
