"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, hasAccess } from "../providers";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function PayrollPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/payroll/summary?month=${month}`);
    const data = await res.json();
    if (res.ok) setRows(data.users || []);
    else setRows([]);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const totalNet = useMemo(() => rows.reduce((a, r) => a + (r.netSalary || 0), 0), [rows]);

  const canAccess = hasAccess(user, "payroll");
  if (!canAccess) {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Payroll</h1>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label>Bulan</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }).map((_, idx) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - idx);
                  const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  return <SelectItem key={m} value={m}>{m}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Base Salary</TableHead>
            <TableHead className="text-right">Lateness (min)</TableHead>
            <TableHead className="text-right">Penalty</TableHead>
            <TableHead className="text-right">Overtime (min)</TableHead>
            <TableHead className="text-right">Overtime Pay</TableHead>
            <TableHead className="text-right">Net</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell>{r.user.name}</TableCell>
              <TableCell>{r.user.role}</TableCell>
              <TableCell className="text-right">Rp {r.user.baseSalary.toLocaleString("id-ID")}</TableCell>
              <TableCell className="text-right">{r.totals.latenessMinutes}</TableCell>
              <TableCell className="text-right">Rp {r.penalty.toLocaleString("id-ID")}</TableCell>
              <TableCell className="text-right">{r.totals.overtimeMinutes}</TableCell>
              <TableCell className="text-right">Rp {r.overtimePay.toLocaleString("id-ID")}</TableCell>
              <TableCell className="text-right font-medium">Rp {r.netSalary.toLocaleString("id-ID")}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-right font-medium">Total</TableCell>
              <TableCell className="text-right font-semibold">Rp {totalNet.toLocaleString("id-ID")}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
