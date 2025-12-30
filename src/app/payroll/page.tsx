"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, hasAccess } from "../providers";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

type PayrollRow = {
  user: { id: number; name: string; username?: string; role: string; baseSalary: number; hourlyRate: number; penaltyRate: number };
  totals: { latenessMinutes: number; workedMinutes: number; overtimeMinutes: number };
  penalty: number;
  manualPenalty?: number;
  manualPenaltyDetails?: Array<{ amount: number; reason: string | null }>;
  overtimePay: number;
  netSalary: number;
  bonus?: number;
};

type OvertimeDetail = {
  id: number;
  userId: number;
  userName: string;
  startAt: string;
  endAt: string;
  minutes: number;
  pay: number;
};

export default function PayrollPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [overtimeRows, setOvertimeRows] = useState<OvertimeDetail[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/payroll/summary?month=${month}`);
    const data: { users?: PayrollRow[]; overtimeDetails?: OvertimeDetail[] } = await res.json();
    if (res.ok) {
      setRows(data.users || []);
      setOvertimeRows(Array.isArray(data.overtimeDetails) ? data.overtimeDetails : []);
    } else {
      setRows([]);
      setOvertimeRows([]);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const totalNet = useMemo(() => rows.reduce((a, r) => a + (r.netSalary || 0), 0), [rows]);
  const dfDateTimeJakarta = useMemo(
    () => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }),
    []
  );
  const dfDateJakarta = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }),
    []
  );
  const dateKey = useCallback((v: string | Date) => dfDateJakarta.format(new Date(v)), [dfDateJakarta]);
  const filteredOvertime = useMemo(() => {
    return overtimeRows.filter((o) => {
      const key = dateKey(o.startAt);
      if (startDate && key < startDate) return false;
      if (endDate && key > endDate) return false;
      return true;
    });
  }, [overtimeRows, startDate, endDate, dateKey]);
  const overtimePerPerson = useMemo(() => {
    const m = new Map<number, { userId: number; userName: string; entries: number; minutes: number; pay: number }>();
    for (const o of filteredOvertime) {
      const prev = m.get(o.userId) ?? { userId: o.userId, userName: o.userName, entries: 0, minutes: 0, pay: 0 };
      prev.entries += 1;
      prev.minutes += o.minutes;
      prev.pay += o.pay;
      m.set(o.userId, prev);
    }
    return Array.from(m.values()).sort((a, b) => b.pay - a.pay || a.userName.localeCompare(b.userName));
  }, [filteredOvertime]);

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
            <TableHead className="text-right">Penalty Telat</TableHead>
            <TableHead className="text-right">Penalty Manual</TableHead>
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
              <TableCell className="text-right">
                Rp {Number(r.manualPenalty || 0).toLocaleString("id-ID")}
                {r.manualPenaltyDetails && r.manualPenaltyDetails.length > 0 && (
                  <div className="text-xs text-gray-600">
                    {r.manualPenaltyDetails.map((d, idx) => (
                      <div key={idx}>Rp {Number(d.amount || 0).toLocaleString("id-ID")}{d.reason ? ` - ${d.reason}` : ""}</div>
                    ))}
                  </div>
                )}
              </TableCell>
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold leading-snug">Detail Overtime</h2>
            <p className="text-sm text-gray-600">Pengajuan overtime yang disetujui untuk bulan {month}</p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label>Dari Tanggal (Jakarta)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Sampai Tanggal (Jakarta)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <Button variant="ghost" onClick={() => { setStartDate(""); setEndDate(""); }}>Reset</Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Mulai (Jakarta)</TableHead>
              <TableHead>Selesai (Jakarta)</TableHead>
              <TableHead className="text-right">Durasi (menit)</TableHead>
              <TableHead className="text-right">Overtime Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOvertime.map((o) => (
              <TableRow key={o.id}>
                <TableCell>{dateKey(o.startAt)}</TableCell>
                <TableCell>{o.userName}</TableCell>
                <TableCell>{dfDateTimeJakarta.format(new Date(o.startAt))}</TableCell>
                <TableCell>{dfDateTimeJakarta.format(new Date(o.endAt))}</TableCell>
                <TableCell className="text-right">{o.minutes}</TableCell>
                <TableCell className="text-right">Rp {o.pay.toLocaleString("id-ID")}</TableCell>
              </TableRow>
            ))}
            {filteredOvertime.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-gray-600">Tidak ada data overtime untuk filter ini.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Total per Orang (filter aktif)</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Jumlah Entry</TableHead>
                <TableHead className="text-right">Total Durasi (menit)</TableHead>
                <TableHead className="text-right">Total Overtime Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overtimePerPerson.map((p) => (
                <TableRow key={p.userId}>
                  <TableCell>{p.userName}</TableCell>
                  <TableCell className="text-right">{p.entries}</TableCell>
                  <TableCell className="text-right">{p.minutes}</TableCell>
                  <TableCell className="text-right">Rp {p.pay.toLocaleString("id-ID")}</TableCell>
                </TableRow>
              ))}
              {overtimePerPerson.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-gray-600">Tidak ada data.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
