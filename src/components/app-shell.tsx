"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";
import { useAuth, hasAccess } from "../app/providers";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white text-black flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 border-r bg-white text-black flex-col">
        <div className="flex items-center gap-3 p-4 border-b">
          <Image src="/assets/Logo White.png" alt="Logo" width={40} height={40} className="rounded" />
        </div>
        <nav className="flex-1 p-2 space-y-2">
          {links.filter(l => l.show).map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded px-3 py-2 text-sm border ${active ? "bg-black text-white border-black" : "bg-white text-black hover:bg-gray-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t text-xs">
          <div className="font-medium">{user ? user.name : "-"}</div>
          <div className="text-gray-600">{user ? user.role : ""}</div>
          {user && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setUser(null); router.replace("/login"); }}>Logout</Button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {/* Mobile header */}
        <header className="h-14 border-b flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)}>Menu</Button>
              <Image src="/assets/Logo White.png" alt="Logo" width={28} height={28} className="rounded" />
            </div>
            <div className="hidden md:block text-sm text-gray-600">{user ? `Hi, ${user.name}` : ''}</div>
          </div>
          <div className="text-sm text-gray-600">{user ? user.role : ''}</div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </main>

      {/* Mobile nav dialog */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="p-0 sm:max-w-sm">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Navigasi</DialogTitle>
          </DialogHeader>
          <nav className="p-2 space-y-2">
            {links.filter(l => l.show).map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded px-3 py-2 text-sm border ${active ? "bg-black text-white border-black" : "bg-white text-black"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {user && (
            <div className="px-4 pb-4">
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setUser(null); setMobileOpen(false); router.replace("/login"); }}>Logout</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
