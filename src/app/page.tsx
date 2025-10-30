"use client";
import Link from "next/link";
import { useAuth, hasAccess } from "./providers";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function HomePage() {
  // client component implicitly because providers uses client
  const { user, setUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (user.role === "Manager") router.replace("/reports");
    else router.replace("/dashboard");
  }, [user, router]);
  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mugifumi App</h1>
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <span>Login sebagai:</span>
          <span className="font-medium">{user ? `${user.name} (${user.role})` : "-"}</span>
          {user && (
            <Button variant="outline" size="sm" onClick={() => setUser(null)}>
              Logout
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasAccess(user, "products") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/products" className="block">
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>Master data produk</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "attendance") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/attendance" className="block">
              <CardHeader>
                <CardTitle>Attendance</CardTitle>
                <CardDescription>Clock-in dan ringkasan absen</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "overtime") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/overtime" className="block">
              <CardHeader>
                <CardTitle>Overtime</CardTitle>
                <CardDescription>Ajukan lembur & status</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "overtimeApprovals") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/overtime/approvals" className="block">
              <CardHeader>
                <CardTitle>Overtime Approvals</CardTitle>
                <CardDescription>Approve/reject pengajuan lembur</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "payroll") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/payroll" className="block">
              <CardHeader>
                <CardTitle>Payroll</CardTitle>
                <CardDescription>Ringkasan gaji bulanan</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "inventory") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/inventory" className="block">
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>Scan in/out, pindah lokasi</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "orders") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/orders" className="block">
              <CardHeader>
                <CardTitle>Orders</CardTitle>
                <CardDescription>Buat pesanan baru</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "delivery") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/delivery" className="block">
              <CardHeader>
                <CardTitle>Delivery</CardTitle>
                <CardDescription>Proses pengiriman pesanan</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "reports") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/reports" className="block">
              <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>Ringkasan inventory & penjualan</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "finance") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/finance" className="block">
              <CardHeader>
                <CardTitle>Finance Operations</CardTitle>
                <CardDescription>Weekly plan, actual, dan laporan finance</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
        {hasAccess(user, "users") && (
          <Card className="hover:shadow-sm transition-shadow">
            <Link href="/users" className="block">
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Kelola pengguna & role</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}
      </div>
    </main>
  );
}
