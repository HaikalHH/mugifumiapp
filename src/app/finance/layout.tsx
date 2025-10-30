"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "../providers";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";

const NAV_ITEMS = [
  { href: "/finance/plan", label: "Weekly Plan" },
  { href: "/finance/actual", label: "Weekly Actual" },
  { href: "/finance/weeks", label: "Week Master" },
  { href: "/finance/report", label: "Reports" },
];

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Button key={item.href} asChild variant={active ? "default" : "outline"} size="sm">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            );
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
