"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, hasAccess } from "../providers";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function AttendancePage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ workedMinutes: number; latenessMinutes: number; hourlyRate: number; latenessPenalty: number; overtimeMinutes?: number } | null>(null);
  const [overtime, setOvertime] = useState<Array<{ id: number; startAt: string; endAt: string; minutes: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasToday, setHasToday] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const d = new Date();
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const res = await fetch(`/api/attendance/me?userId=${user.id}&month=${encodeURIComponent(monthStr)}`);
    const data = await res.json();
    if (res.ok) {
      setRecords(data.records || []);
      setTotals(data.totals || null);
      setOvertime(data.overtime || []);
      // detect today's Jakarta date exists
      try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })
          .formatToParts(now)
          .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
        const anchorISO = `${parts.year}-${parts.month}-${parts.day}`;
        const found = (data.records || []).some((r: any) => {
          const rd = new Date(r.date);
          const rp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })
            .formatToParts(rd)
            .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
          const rISO = `${rp.year}-${rp.month}-${rp.day}`;
          return rISO === anchorISO;
        });
        setHasToday(found);
      } catch {}
    } else {
      setRecords([]);
      setTotals(null);
      setHasToday(false);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const canAccess = hasAccess(user, "attendance");

  const handleClockIn = async () => {
    if (!user) return;
    const res = await fetch("/api/attendance/clock-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    if (res.ok) {
      setOpen(false);
      load();
    }
  };

  const workedHours = useMemo(() => (totals ? Math.round((totals.workedMinutes / 60) * 10) / 10 : 0), [totals]);
  const overtimeHours = useMemo(() => (totals && totals.overtimeMinutes != null ? Math.round((totals.overtimeMinutes / 60) * 10) / 10 : 0), [totals]);

  const fmtJakarta = (v: string | Date) =>
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
      hourCycle: "h23",
    }).format(new Date(v));

  if (!canAccess) {
    return (
      <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Attendance</h1>
        <Button onClick={() => setOpen(true)} disabled={hasToday} title={hasToday ? "Sudah clock in hari ini" : undefined}>
          {hasToday ? "Sudah Clock In" : "Clock In"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-md p-4">
          <div className="text-sm text-gray-500">Total Jam Kerja</div>
          <div className="text-xl font-semibold">{workedHours} jam</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-sm text-gray-500">Keterlambatan</div>
          <div className="text-xl font-semibold">{totals ? totals.latenessMinutes : 0} menit</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-sm text-gray-500">Potongan Keterlambatan</div>
          <div className="text-xl font-semibold">Rp {totals ? totals.latenessPenalty.toLocaleString("id-ID") : 0}</div>
        </div>
        <div className="border rounded-md p-4 md:col-span-3">
          <div className="text-sm text-gray-500">Overtime Disetujui</div>
          <div className="text-sm">Total: {totals?.overtimeMinutes || 0} menit ({overtimeHours} jam)</div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal (Jakarta)</TableHead>
            <TableHead>Clock In (Jakarta)</TableHead>
            <TableHead>Clock Out (Jakarta)</TableHead>
            <TableHead className="text-right">Worked (min)</TableHead>
            <TableHead className="text-right">Late (min)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => {
            const local = new Date(r.date);
            const d = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }).format(local);
            return (
              <TableRow key={r.id}>
                <TableCell>{d}</TableCell>
                <TableCell>{fmtJakarta(r.clockInAt)}</TableCell>
                <TableCell>{r.clockOutAt ? fmtJakarta(r.clockOutAt) : "-"}</TableCell>
                <TableCell className="text-right">{r.workedMinutes}</TableCell>
                <TableCell className="text-right">{r.latenessMinutes}</TableCell>
              </TableRow>
            );
          })}
          {!loading && records.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-gray-500">Belum ada data</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {overtime.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Overtime Disetujui</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mulai (Jakarta)</TableHead>
                <TableHead>Selesai (Jakarta)</TableHead>
                <TableHead className="text-right">Durasi (min)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overtime.map((ot) => (
                <TableRow key={ot.id}>
                  <TableCell>{fmtJakarta(ot.startAt)}</TableCell>
                  <TableCell>{fmtJakarta(ot.endAt)}</TableCell>
                  <TableCell className="text-right">{ot.minutes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clock In</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>Waktu akan disimpan dalam UTC dan ditetapkan ke tanggal Jakarta saat ini.</div>
            <Button onClick={handleClockIn}>Clock In Now (UTC)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
