"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth, lockedLocation, hasRole } from "../providers";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

type StockInfo = { total: number; reserved: number; available: number };

export default function DashboardPage() {
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [negatives, setNegatives] = useState<Array<{ key: string; available: number; loc: string }>>([]);
  const [alerts, setAlerts] = useState<Array<{ id: number; customer?: string; outlet?: string; status?: string; actPayout?: number }>>([]);
  const [net, setNet] = useState<number | null>(null);
  const [baseAfterPenalty, setBaseAfterPenalty] = useState<number | null>(null);
  const [overtimePay, setOvertimePay] = useState<number | null>(null);
  const [monthBonus, setMonthBonus] = useState<number | null>(null);

  const monthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!user) return;
    const isBandung = hasRole(user, "Bandung");
    const isJakarta = hasRole(user, "Jakarta");
    const isSales = hasRole(user, "Sales");
    const isBDGSales = hasRole(user, "BDGSales");
    const isBaker = hasRole(user, "Baker");
    const locLock = lockedLocation(user);

    const tasks: Promise<any>[] = [];
    // For Jakarta/Bandung dashboard: pending orders + negative stock (locked region)
    if (isBandung || isJakarta) {
      const params = new URLSearchParams({ page: "1", pageSize: "10" });
      if (locLock) params.set("location", locLock);
      tasks.push(
        fetch(`/api/orders/pending?${params.toString()}`).then((r) => r.json()).then((d) => setPendingOrders(d.rows || [])).catch(() => setPendingOrders([]))
      );
      tasks.push(
        fetch(`/api/inventory/overview`).then((r) => r.json()).then((d) => {
          const list: Array<{ key: string; available: number; loc: string }> = [];
          if (d?.byLocation) {
            Object.entries(d.byLocation as Record<string, Record<string, StockInfo>>).forEach(([loc, rows]) => {
              if (!locLock || locLock === loc) {
                Object.entries(rows).forEach(([k, v]) => { if (v.available < 0) list.push({ key: k, available: v.available, loc }); });
              }
            });
          }
          setNegatives(list);
        }).catch(() => setNegatives([]))
      );
    }

    // For Baker: inventory minus across ALL locations (no region lock)
    if (isBaker) {
      tasks.push(
        fetch(`/api/inventory/overview`).then((r) => r.json()).then((d) => {
          const list: Array<{ key: string; available: number; loc: string }> = [];
          if (d?.byLocation) {
            Object.entries(d.byLocation as Record<string, Record<string, StockInfo>>).forEach(([loc, rows]) => {
              Object.entries(rows).forEach(([k, v]) => { if (v.available < 0) list.push({ key: k, available: v.available, loc }); });
            });
          }
          setNegatives(list);
        }).catch(() => setNegatives([]))
      );
    }

    // For Sales dashboard: orders with NOT PAID or missing actPayout
    // For BDGSales, follow Bandung dashboard only (skip Sales alerts)
    if (isSales && !isBDGSales) {
      const params = new URLSearchParams({ page: "1", pageSize: "20" });
      tasks.push(
        fetch(`/api/orders?${params.toString()}`).then((r) => r.json()).then((d) => {
          const items = (d.rows || []).filter((o: any) => String(o.status).toUpperCase() === "NOT PAID" || (o.outlet && (o.outlet === "Tokopedia" || o.outlet === "Shopee" || o.outlet === "Wholesale" || o.outlet === "Complain") && (!o.actPayout || Number(o.actPayout) === 0)));
          setAlerts(items);
        }).catch(() => setAlerts([]))
      );
    }

    // For Sales/Jakarta/Bandung: show net salary for this month
    if (isSales || isBandung || isJakarta || isBaker) {
      tasks.push(
        fetch(`/api/payroll/summary?month=${monthStr}`).then((r) => r.json()).then((d) => {
          const me = (d.users || []).find((x: any) => x.user?.id === user.id);
          if (me) {
            setNet(me.netSalary);
            const base = me.user?.baseSalary || 0;
            const penalty = me.penalty || 0;
            setBaseAfterPenalty(Math.max(0, base - penalty));
            setOvertimePay(me.overtimePay || 0);
            setMonthBonus(me.bonus || 0);
          } else {
            setNet(null); setBaseAfterPenalty(null); setOvertimePay(null); setMonthBonus(null);
          }
        }).catch(() => setNet(null))
      );
    }

    Promise.all(tasks);
  }, [user, monthStr]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {(hasRole(user, "Bandung") || hasRole(user, "Jakarta")) && (
        <div className="space-y-4">
          <section>
            <div className="font-medium mb-2">Delivery Pending</div>
            {pendingOrders.length === 0 ? (
              <div className="text-sm text-gray-600">Tidak ada pending delivery.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.id}</TableCell>
                      <TableCell>{o.outlet}</TableCell>
                      <TableCell>{o.customer || '-'}</TableCell>
                      <TableCell>{o.location}</TableCell>
                      <TableCell className="text-right text-sm"><Link href="/delivery" className="underline">Process</Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section>
            <div className="font-medium mb-2">Inventory Minus</div>
            {negatives.length === 0 ? (
              <div className="text-sm text-gray-600">Tidak ada stok minus.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Menu</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negatives.map((n, idx) => (
                    <TableRow key={`${n.loc}-${n.key}-${idx}`}>
                      <TableCell>{n.loc}</TableCell>
                      <TableCell>{n.key}</TableCell>
                      <TableCell className="text-right text-red-600">{n.available}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      )}

      {hasRole(user, "Baker") && (
        <section>
          <div className="font-medium mb-2">Inventory Minus (All Locations)</div>
          {negatives.length === 0 ? (
            <div className="text-sm text-gray-600">Tidak ada stok minus.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Menu</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negatives.map((n, idx) => (
                  <TableRow key={`${n.loc}-${n.key}-${idx}`}>
                    <TableCell>{n.loc}</TableCell>
                    <TableCell>{n.key}</TableCell>
                    <TableCell className="text-right text-red-600">{n.available}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {hasRole(user, "Sales") && !hasRole(user, "BDGSales") && (
        <section>
          <div className="font-medium mb-2">Orders Perlu Tindakan</div>
          {alerts.length === 0 ? (
            <div className="text-sm text-gray-600">Tidak ada order bermasalah.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.id}</TableCell>
                    <TableCell>{o.outlet}</TableCell>
                    <TableCell>{o.status}</TableCell>
                    <TableCell className="text-right">{o.actPayout ? `Rp ${Number(o.actPayout).toLocaleString('id-ID')}` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {(hasRole(user, "Sales") || hasRole(user, "Bandung") || hasRole(user, "Jakarta") || hasRole(user, "Baker")) && (
        <section>
          <div className="font-medium mb-1">Estimasi Gaji Bulan Ini</div>
          <div className="text-2xl font-semibold">Rp {net != null ? net.toLocaleString('id-ID') : 0}</div>
          <div className="mt-1 text-sm text-gray-700">
            <div>Pokok (setelah potongan): <span className="font-medium">Rp {Math.max(0, baseAfterPenalty || 0).toLocaleString('id-ID')}</span></div>
            <div>Overtime: <span className="font-medium">Rp {Math.max(0, overtimePay || 0).toLocaleString('id-ID')}</span></div>
            <div>Bonus Terkumpul Bulan Ini: <span className="font-medium">Rp {Math.max(0, monthBonus || 0).toLocaleString('id-ID')}</span></div>
          </div>
        </section>
      )}
    </div>
  );
}
