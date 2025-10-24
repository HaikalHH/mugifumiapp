"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "../providers";
import { cn } from "../../lib/utils";

const NAV_ITEMS = [
  { href: "/finance/plan", label: "Monthly Plan" },
  { href: "/finance/actual", label: "Monthly Actual" },
  { href: "/finance/report", label: "Reports" },
];

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const { username } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (username !== "Admin") {
      router.replace("/"); // redirect non-admin users
    }
  }, [username, router]);

  if (username !== "Admin") {
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
        <div className="flex items-center gap-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1 rounded-md border text-sm transition-colors",
                  active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100 border-gray-200",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
