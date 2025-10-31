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
  const [reportOpen, setReportOpen] = useState(() => pathname.startsWith("/reports"));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white text-black flex">
      {/* Sidebar (desktop only) */}
      <aside className="hidden md:flex w-60 border-r bg-black text-white flex-col">
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
          {hasAccess(user, "reports") && (
            <div className="space-y-1">
              <button
                type="button"
                className="w-full text-left block rounded px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => setReportOpen((v) => !v)}
              >
                Reports
              </button>
              {reportOpen && (
                <div className="pl-3 space-y-1">
                  <Link href="/reports/sales" className={`block rounded px-3 py-2 text-sm ${pathname === "/reports/sales" ? "bg-white text-black" : "hover:bg-white/10"}`}>Sales</Link>
                  <Link href="/reports/inventory" className={`block rounded px-3 py-2 text-sm ${pathname === "/reports/inventory" ? "bg-white text-black" : "hover:bg-white/10"}`}>Inventory</Link>
                  <Link href="/reports/finance" className={`block rounded px-3 py-2 text-sm ${pathname === "/reports/finance" ? "bg-white text-black" : "hover:bg-white/10"}`}>Finance</Link>
                </div>
              )}
            </div>
          )}
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
          {/* Mobile: menu + small logo */}
          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>Menu</Button>
              <Image src="/assets/Logo White.png" alt="Logo" width={28} height={28} className="rounded" />
            </div>
            <div className="hidden md:block text-sm text-gray-600">{user ? `Hi, ${user.name}` : ''}</div>
          </div>
          <div className="text-sm text-gray-600">{user ? user.role : ''}</div>
        </header>
        <div className="p-4">{children}</div>
      </main>

      {/* Mobile navigation dialog */}
      <Dialog open={reportOpen && typeof window !== 'undefined' && window.innerWidth < 768} onOpenChange={setReportOpen}>
        <DialogContent className="p-0 sm:max-w-sm">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Navigasi</DialogTitle>
          </DialogHeader>
          <nav className="p-2 space-y-1">
            {links.filter(l => l.show).map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setReportOpen(false)}
                  className={`block rounded px-3 py-2 text-sm ${active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
                >
                  {l.label}
                </Link>
              );
            })}
            {hasAccess(user, "reports") && (
              <div className="mt-2">
                <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500">Reports</div>
                <div className="pl-2 space-y-1">
                  <Link href="/reports/sales" onClick={() => setReportOpen(false)} className={`block rounded px-3 py-2 text-sm ${pathname === '/reports/sales' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}>Sales</Link>
                  <Link href="/reports/inventory" onClick={() => setReportOpen(false)} className={`block rounded px-3 py-2 text-sm ${pathname === '/reports/inventory' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}>Inventory</Link>
                  <Link href="/reports/finance" onClick={() => setReportOpen(false)} className={`block rounded px-3 py-2 text-sm ${pathname === '/reports/finance' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}>Finance</Link>
                </div>
              </div>
            )}
            {user && (
              <div className="px-2 pt-2">
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setUser(null); setReportOpen(false); router.replace('/login'); }}>Logout</Button>
              </div>
            )}
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  );
}
