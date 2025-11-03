"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "../providers";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role !== "Admin") {
      router.replace("/"); // redirect non-admin users
    }
  }, [user, router]);

  if (user?.role !== "Admin") {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Finance Operations</h1>
      </div>
      <div>{children}</div>
    </div>
  );
}
