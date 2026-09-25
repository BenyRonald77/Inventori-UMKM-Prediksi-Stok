import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventori UMKM + Prediksi Stok",
  description:
    "Aplikasi inventori UMKM dengan prediksi kebutuhan stok berbasis layanan machine learning FastAPI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
