"use client";

import { ReactNode, useEffect } from "react";
import { useAuth, hasAccess } from "../providers";
import { useRouter } from "next/navigation";

export default function PlanningLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  const allowed = hasAccess(user, 'planning');

  useEffect(() => {
    if (!allowed) {
      router.replace("/");
    }
  }, [allowed, router]);

  if (!allowed) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planning Helper</h1>
      </div>
      <div>{children}</div>
    </div>
  );
}
