"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth, lockedLocation, hasRole } from "../providers";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Label } from "../../components/ui/label";

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
  const [yearly, setYearly] = useState<null | {
    year: number;
    months: Array<{ month: number; income: number; expense: number; profit: number }>;
    totalIncome: number;
    totalExpense: number;
    totalProfit: number;
  }>(null);

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

    // Admin/Manager annual summary
    if (hasRole(user, "Admin") || hasRole(user, "Manager")) {
      const yearNow = new Date().getFullYear();
      tasks.push(
        fetch(`/api/finance/report?year=${yearNow}`)
          .then((r) => r.json())
          .then((d) => {
            const reports = Array.isArray(d.reports) ? d.reports : [];
            const monthsMap = new Map<number, { month: number; income: number; expense: number; profit: number }>();
            for (let m = 1; m <= 12; m++) monthsMap.set(m, { month: m, income: 0, expense: 0, profit: 0 });
            for (const rp of reports) {
              const m = Number(rp.month || new Date(rp.startDate).getMonth() + 1);
              const slot = monthsMap.get(m)!;
              const income = Number(rp.actualRevenue || 0);
              const expense = Number(rp.actual?.total || 0);
              slot.income += income;
              slot.expense += expense;
              slot.profit += (income - expense);
            }
            const months = Array.from(monthsMap.values()).filter(x => x.income || x.expense || x.profit);
            const totalIncome = months.reduce((s, x) => s + x.income, 0);
            const totalExpense = months.reduce((s, x) => s + x.expense, 0);
            const totalProfit = months.reduce((s, x) => s + x.profit, 0);
            setYearly({ year: yearNow, months, totalIncome, totalExpense, totalProfit });
          })
          .catch(() => setYearly(null))
      );
    }

    Promise.all(tasks);
  }, [user, monthStr]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {(hasRole(user, "Admin") || hasRole(user, "Manager")) && yearly && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="font-medium">Ringkasan Finance Tahun {yearly.year}</div>
            <div className="text-sm text-gray-600">Actual-based</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded p-3">
              <Label>Pemasukan (Actual)</Label>
              <div className="text-lg font-semibold">Rp {yearly.totalIncome.toLocaleString('id-ID')}</div>
            </div>
            <div className="border rounded p-3">
              <Label>Pengeluaran (Actual)</Label>
              <div className="text-lg font-semibold">Rp {yearly.totalExpense.toLocaleString('id-ID')}</div>
            </div>
            <div className="border rounded p-3">
              <Label>Net (Untung/Rugi)</Label>
              <div className={`text-lg font-semibold ${yearly.totalProfit < 0 ? 'text-red-600' : yearly.totalProfit > 0 ? 'text-green-600' : ''}`}>
                Rp {yearly.totalProfit.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px] md:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Bulan</TableHead>
                  <TableHead className="text-right">Pemasukan</TableHead>
                  <TableHead className="text-right">Pengeluaran</TableHead>
                  <TableHead className="text-right">Untung/Rugi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearly.months.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-gray-600">Belum ada data tahun ini</TableCell>
                  </TableRow>
                )}
                {yearly.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{String(m.month).padStart(2,'0')}</TableCell>
                    <TableCell className="text-right">Rp {Math.round(m.income).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">Rp {Math.round(m.expense).toLocaleString('id-ID')}</TableCell>
                    <TableCell className={`text-right ${m.profit < 0 ? 'text-red-600' : m.profit > 0 ? 'text-green-600' : ''}`}>
                      Rp {Math.round(m.profit).toLocaleString('id-ID')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

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
