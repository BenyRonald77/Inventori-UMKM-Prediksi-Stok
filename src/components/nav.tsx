"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <nav className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
      <Link
        href="/dashboard"
        className={`text-sm font-medium ${
          pathname === "/dashboard" ? "text-brand-700" : "text-slate-500 hover:text-brand-600"
        }`}
      >
        Dashboard
      </Link>
      <button
        onClick={handleLogout}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        Keluar
      </button>
    </nav>
  );
}
