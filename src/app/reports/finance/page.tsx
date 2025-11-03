"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAuth } from "../../providers";

type CategoryRow = { category: string; amount: number };
type PeriodReport = {
  periodId: number;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  actualRevenue: number;
  plan: { total: number; byCategory: CategoryRow[] };
  actual: { total: number; byCategory: CategoryRow[] };
  netProfitPlan: number;
  netProfitActual: number;
};

export default function ReportsFinancePage() {
  const { user } = useAuth();
  const [year, setYear] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [reports, setReports] = useState<PeriodReport[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (year && year !== "ALL") params.set("year", year);
    if (month && month !== "ALL") params.set("month", month);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const data = await fetch(`/api/finance/report${qs}`).then((r) => r.json()).catch(() => ({ reports: [] }));
    setReports(Array.isArray(data.reports) ? data.reports : []);
  }, [year, month]);

  useEffect(() => { if (user?.role === "Admin" || user?.role === "Manager") load(); }, [user, load]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 5 }).map((_, i) => String(now - i));
  }, []);
  const months = useMemo(() => Array.from({ length: 12 }).map((_, i) => String(i + 1)), []);

  if (user?.role !== "Admin" && user?.role !== "Manager") {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label>Tahun</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Semua" /></SelectTrigger>
            <SelectContent>
              <SelectItem key="all" value="ALL">Semua</SelectItem>
              {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Bulan</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Semua" /></SelectTrigger>
            <SelectContent>
              <SelectItem key="m-all" value="ALL">Semua</SelectItem>
              {months.map((m) => (<SelectItem key={m} value={m}>{m.padStart(2,'0')}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {reports.length === 0 ? (
          <div className="text-sm text-gray-600">Tidak ada data.</div>
        ) : (
          reports.map((r) => (
            <section key={r.periodId} className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{r.name} ({String(r.month).padStart(2,'0')}/{r.year})</div>
                  <div className="text-xs text-gray-600">{new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Actual Revenue</div>
                  <div className="text-xl font-semibold">Rp {r.actualRevenue.toLocaleString('id-ID')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-medium mb-1">Plan</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Jumlah (Rp)</TableHead>
                        <TableHead className="text-right">Persen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.plan.byCategory.map((c, idx) => {
                        const pct = r.plan.total > 0 ? (c.amount / r.plan.total) * 100 : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell>{c.category}</TableCell>
                            <TableCell className="text-right">Rp {Math.round(c.amount).toLocaleString('id-ID')}</TableCell>
                            <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell className="font-medium">Total</TableCell>
                        <TableCell className="text-right font-semibold">Rp {Math.round(r.plan.total).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-semibold">{r.plan.total > 0 ? '100.0%' : '-'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <div className="font-medium mb-1">Actual</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Jumlah (Rp)</TableHead>
                        <TableHead className="text-right">Persen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.actual.byCategory.map((c, idx) => {
                        const pct = r.actual.total > 0 ? (c.amount / r.actual.total) * 100 : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell>{c.category}</TableCell>
                            <TableCell className="text-right">Rp {Math.round(c.amount).toLocaleString('id-ID')}</TableCell>
                            <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell className="font-medium">Total</TableCell>
                        <TableCell className="text-right font-semibold">Rp {Math.round(r.actual.total).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-semibold">{r.actual.total > 0 ? '100.0%' : '-'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <div className="text-sm text-gray-600">Net Profit (Plan)</div>
                  {(() => {
                    const pct = r.actualRevenue > 0 ? (r.netProfitPlan / r.actualRevenue) * 100 : 0;
                    const color = r.netProfitPlan < 0 ? 'text-red-600' : (r.netProfitPlan > 0 ? 'text-green-600' : '');
                    return (
                      <div className={`text-xl font-semibold ${color}`}>
                        Rp {Math.round(r.netProfitPlan).toLocaleString('id-ID')} <span className="text-sm opacity-80">({pct.toFixed(1)}%)</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="border rounded p-3">
                  <div className="text-sm text-gray-600">Net Profit (Actual)</div>
                  {(() => {
                    const pct = r.actualRevenue > 0 ? (r.netProfitActual / r.actualRevenue) * 100 : 0;
                    const color = r.netProfitActual < 0 ? 'text-red-600' : (r.netProfitActual > 0 ? 'text-green-600' : '');
                    return (
                      <div className={`text-xl font-semibold ${color}`}>
                        Rp {Math.round(r.netProfitActual).toLocaleString('id-ID')} <span className="text-sm opacity-80">({pct.toFixed(1)}%)</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
