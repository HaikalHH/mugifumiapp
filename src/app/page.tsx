"use client";
import Link from "next/link";
import { useAuth, hasAccess } from "./providers";

export default function HomePage() {
  // client component implicitly because providers uses client
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { username, setUsername } = useAuth();
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Mugifumi App</h1>
      <div className="text-sm text-gray-600">Login sebagai: <span className="font-medium">{username || "-"}</span> {username && (<button className="ml-2 underline" onClick={() => setUsername(null)}>Logout</button>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasAccess(username, "products") && (
        <Link href="/products" className="block rounded-md border p-4 hover:bg-gray-50">
          <div className="font-medium">Products</div>
          <div className="text-sm text-gray-600">Master data produk</div>
        </Link>
        )}
        {hasAccess(username, "inventory") && (
        <Link href="/inventory" className="block rounded-md border p-4 hover:bg-gray-50">
          <div className="font-medium">Inventory</div>
          <div className="text-sm text-gray-600">Scan in/out, pindah lokasi</div>
        </Link>
        )}
        {hasAccess(username, "orders") && (
        <Link href="/orders" className="block rounded-md border p-4 hover:bg-gray-50">
          <div className="font-medium">Orders</div>
          <div className="text-sm text-gray-600">Buat pesanan baru</div>
        </Link>
        )}
        {hasAccess(username, "delivery") && (
        <Link href="/delivery" className="block rounded-md border p-4 hover:bg-gray-50">
          <div className="font-medium">Delivery</div>
          <div className="text-sm text-gray-600">Proses pengiriman pesanan</div>
        </Link>
        )}
        {hasAccess(username, "reports") && (
        <Link href="/reports" className="block rounded-md border p-4 hover:bg-gray-50">
          <div className="font-medium">Reports</div>
          <div className="text-sm text-gray-600">Ringkasan inventory & penjualan</div>
        </Link>
        )}
      </div>
    </main>
  );
}
