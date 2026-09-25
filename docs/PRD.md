# PRD — Inventori UMKM + Prediksi Stok

| | |
|---|---|
| **Dokumen** | Product Requirements Document |
| **Produk** | Inventori UMKM + Prediksi Stok |
| **Versi** | 1.0 |
| **Tanggal** | 25 September 2026 |
| **Pemilik Produk** | BenyRonald77 |
| **Status** | Draft — untuk implementasi |

---

## 1. Latar Belakang & Masalah

Pelaku UMKM (toko kelontong, warung, reseller kecil) umumnya mencatat stok
barang secara manual atau di buku/spreadsheet. Masalah yang muncul:

- Stok kehabisan tanpa peringatan dini, menyebabkan kehilangan penjualan.
- Kelebihan stok pada barang yang permintaannya menurun, mengunci modal.
- Tidak ada gambaran tren penjualan/pemakaian untuk memperkirakan kebutuhan restock ke depan.

## 2. Tujuan Produk

Membangun aplikasi inventori sederhana yang dilengkapi **prediksi kebutuhan
stok** berbasis riwayat transaksi, dengan arsitektur:

1. Aplikasi web (Next.js) untuk mencatat produk dan transaksi stok masuk/keluar.
2. Layanan machine learning terpisah (**FastAPI**, Python) yang menghitung
   prediksi stok berdasarkan tren historis, dipanggil oleh aplikasi Next.js
   sebagai REST API.
3. Dashboard yang menampilkan grafik histori pemakaian & proyeksi kebutuhan
   stok ke depan, serta peringatan stok rendah.

### Tujuan Terukur

| Metrik | Target |
|---|---|
| Prediksi stok tersedia untuk produk dengan ≥ 7 titik data histori transaksi keluar | otomatis dihitung on-demand |
| Waktu respons endpoint prediksi | < 2 detik untuk 1 produk |
| Peringatan stok rendah muncul di dashboard | real-time saat stok ≤ titik reorder |

## 3. Target Pengguna

| Peran | Deskripsi | Akses |
|---|---|---|
| **Admin UMKM** | Pemilik/karyawan toko yang mencatat produk & transaksi stok, memantau dashboard | Login (single tenant per instance) |

## 4. Lingkup (Scope)

### 4.1 Dalam Lingkup (MVP)

1. **Manajemen produk**: CRUD produk (SKU, nama, kategori, harga, stok saat ini, titik reorder).
2. **Transaksi stok**: catat stok masuk (pembelian/restock) dan stok keluar (penjualan/pemakaian), stok produk ter-update otomatis setiap transaksi.
3. **Riwayat transaksi** per produk, terurut berdasarkan tanggal.
4. **Layanan prediksi stok (FastAPI)**: endpoint `/forecast` menerima deret waktu jumlah stok keluar harian sebuah produk, mengembalikan proyeksi kebutuhan N hari ke depan menggunakan model tren (regresi linear atas rata-rata bergerak).
5. **Integrasi**: aplikasi Next.js memanggil layanan FastAPI melalui endpoint API internal, menyimpan cache hasil prediksi agar tidak selalu menghitung ulang.
6. **Dashboard**: daftar produk dengan indikator stok rendah, grafik histori pemakaian vs. proyeksi untuk produk terpilih.
7. **Peringatan stok rendah**: produk dengan `currentStock <= reorderPoint` ditandai di dashboard.

### 4.2 Luar Lingkup (fase berikutnya)

- Multi-toko/multi-cabang.
- Model ML lanjutan (ARIMA, Prophet, deep learning) — MVP memakai model tren sederhana yang transparan & mudah dijelaskan ke pengguna non-teknis.
- Integrasi POS/kasir otomatis (stok keluar masih dicatat manual di MVP).
- Rekomendasi otomatis jumlah pembelian ke supplier.

## 5. Alur Pengguna Utama

### 5.1 Alur — Mencatat Transaksi Stok

1. Admin login ke dashboard.
2. Memilih produk, mencatat transaksi (masuk/keluar) beserta jumlah & catatan opsional.
3. `currentStock` produk ter-update otomatis (bertambah untuk stok masuk, berkurang untuk stok keluar).
4. Bila `currentStock` turun ≤ `reorderPoint`, produk ditandai "Stok Rendah" di dashboard.

### 5.2 Alur — Melihat Prediksi Stok

1. Admin membuka halaman detail produk.
2. Frontend meminta data prediksi ke Next.js API (`/api/products/[id]/forecast`).
3. Next.js API mengambil riwayat transaksi keluar produk tersebut, mengirimkannya ke layanan FastAPI (`POST /forecast`).
4. FastAPI menghitung tren (regresi linear) & rata-rata bergerak, mengembalikan proyeksi kebutuhan stok N hari ke depan (default 14 hari).
5. Next.js menyimpan hasil sebagai cache sementara & menampilkannya sebagai grafik histori + proyeksi di dashboard.

## 6. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-1 | Sistem menyediakan CRUD produk (SKU unik, nama, kategori, harga, titik reorder) | Must |
| FR-2 | Sistem mencatat transaksi stok masuk/keluar dan memperbarui `currentStock` secara atomik | Must |
| FR-3 | Sistem menampilkan riwayat transaksi per produk | Must |
| FR-4 | Layanan FastAPI menyediakan endpoint `/forecast` yang menerima deret waktu dan mengembalikan proyeksi N hari ke depan | Must |
| FR-5 | Next.js API memanggil layanan FastAPI dan meneruskan hasilnya ke frontend | Must |
| FR-6 | Dashboard menandai produk dengan stok ≤ titik reorder | Must |
| FR-7 | Bila data historis produk terlalu sedikit (< 7 titik), sistem menampilkan pesan "data belum cukup" alih-alih memaksakan prediksi | Should |
| FR-8 | Hasil prediksi di-cache sementara (mis. per produk per hari) agar tidak memanggil FastAPI berulang untuk data yang sama | Should |

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| **Keandalan** | Transaksi stok & update `currentStock` dilakukan dalam satu transaksi database (atomik) |
| **Ketersediaan** | Bila layanan FastAPI tidak dapat dihubungi, dashboard tetap menampilkan data inventori (prediksi ditampilkan sebagai "tidak tersedia", bukan meng-crash aplikasi) |
| **Portabilitas** | Layanan FastAPI berdiri sendiri (proses/port terpisah) sehingga bisa di-deploy & di-scale independen dari aplikasi Next.js |
| **Transparansi model** | Model forecasting MVP sengaja sederhana (tren linear + rata-rata bergerak) agar mudah dijelaskan ke pengguna non-teknis, bukan black-box |

## 8. Arsitektur Teknis (Ringkasan)

```
┌─────────────────────┐        HTTP (POST /forecast)        ┌───────────────────────┐
│   Next.js (web)      │ ───────────────────────────────────▶│  FastAPI (ml-service)  │
│  - UI & dashboard     │◀─────────────────────────────────── │  - Model forecasting   │
│  - API CRUD produk    │        { forecast: [...] }           │  - numpy/pandas        │
│  - Prisma + SQLite/PG │                                       └───────────────────────┘
└─────────────────────┘
```

- **Frontend & backend utama**: Next.js (TypeScript, App Router), Prisma ORM.
- **Layanan ML**: FastAPI (Python), model regresi linear + moving average dari `numpy`/`pandas`, di-deploy sebagai service HTTP terpisah (folder `ml-service/`).
- **Komunikasi**: Next.js API route memanggil `ML_SERVICE_URL` (env var) via `fetch`.

### 8.1 Entitas Data Utama

- `AdminUser` — akun admin UMKM.
- `Product` — SKU, nama, kategori, harga satuan, stok saat ini, titik reorder.
- `StockTransaction` — produk, jenis (IN/OUT), jumlah, catatan, waktu.
- `ForecastCache` — cache hasil prediksi per produk (opsional, untuk mengurangi panggilan berulang ke FastAPI).

## 9. Kriteria Penerimaan — MVP

- [ ] Admin bisa CRUD produk dan mencatat transaksi stok masuk/keluar; `currentStock` selalu akurat.
- [ ] Dashboard menampilkan daftar produk dengan penanda stok rendah.
- [ ] Layanan FastAPI berjalan independen dan mengembalikan proyeksi stok yang masuk akal dari data uji.
- [ ] Halaman detail produk menampilkan grafik histori + proyeksi hasil pemanggilan FastAPI dari Next.js.
- [ ] Sistem tetap berfungsi (tanpa crash) bila layanan FastAPI sedang tidak aktif.

## 10. Roadmap Implementasi

| # | Milestone |
|---|---|
| 1 | PRD |
| 2 | Scaffold Next.js + Prisma |
| 3 | Schema database & seed |
| 4 | Autentikasi admin |
| 5 | CRUD produk & transaksi stok |
| 6 | Layanan FastAPI prediksi stok |
| 7 | Integrasi Next.js ↔ FastAPI |
| 8 | Dashboard & grafik prediksi |
| 9 | README & dokumentasi deployment |

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Layanan FastAPI down/tidak dijalankan | Fitur prediksi tidak bisa diakses | Next.js menangani error pemanggilan dengan graceful fallback (pesan "prediksi tidak tersedia"), fitur inti (CRUD & stok) tetap berjalan tanpa dependensi ke FastAPI |
| Data historis terlalu sedikit menghasilkan prediksi tidak akurat | Rekomendasi restock keliru | Model menolak menghasilkan proyeksi bila titik data < ambang minimum, menampilkan pesan eksplisit ke pengguna |
| Race condition dua transaksi stok bersamaan | `currentStock` tidak akurat | Update stok dilakukan dalam transaksi database yang sama dengan pencatatan `StockTransaction` |
