"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo } from "react";
import { useAuth, hasAccess } from "../app/providers";
import { Button } from "../components/ui/button";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuth();

  const links = useMemo(
    () => [
      // Home removed; default route goes to Dashboard
      { href: "/dashboard", label: "Dashboard", show: Boolean(user) },
      { href: "/products", label: "Products", show: hasAccess(user, "products") },
      { href: "/inventory", label: "Inventory", show: hasAccess(user, "inventory") },
      { href: "/orders", label: "Orders", show: hasAccess(user, "orders") },
      { href: "/delivery", label: "Delivery", show: hasAccess(user, "delivery") },
      { href: "/reports", label: "Reports", show: hasAccess(user, "reports") },
      { href: "/finance", label: "Finance", show: hasAccess(user, "finance") },
      { href: "/attendance", label: "Attendance", show: hasAccess(user, "attendance") },
      { href: "/overtime", label: "Overtime", show: hasAccess(user, "overtime") },
      { href: "/overtime/approvals", label: "Overtime Approvals", show: hasAccess(user, "overtimeApprovals") },
      { href: "/users", label: "Users", show: hasAccess(user, "users") },
      { href: "/payroll", label: "Payroll", show: hasAccess(user, "payroll") },
    ],
    [user]
  );

  const hideShell = pathname === "/login" || pathname === "/forgot";

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white text-black flex">
      <aside className="w-60 border-r bg-black text-white flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Image src="/assets/Logo White.png" alt="Logo" width={300} height={700} className="rounded" />
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {links.filter(l => l.show).map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href} className={`block rounded px-3 py-2 text-sm ${active ? "bg-white text-black" : "hover:bg-white/10"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-white/80">
          <div className="font-medium text-white">{user ? user.name : "-"}</div>
          <div>{user ? user.role : ""}</div>
          {user && (
            <Button variant="outline" size="sm" className="mt-2 bg-white text-black" onClick={() => { setUser(null); router.replace("/login"); }}>Logout</Button>
          )}
        </div>
      </aside>
      <main className="flex-1">
        <header className="h-14 border-b flex items-center justify-between px-4">
          <div className="text-sm text-gray-600">{user ? `Hi, ${user.name}` : ''}</div>
          <div className="text-sm text-gray-600">{user ? user.role : ''}</div>
        </header>
        <div className="p-4">{children}</div>
      </main>
    </div>
  );
}