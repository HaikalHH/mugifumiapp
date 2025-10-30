"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, hasAccess } from "../providers";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ workedMinutes: number; latenessMinutes: number; hourlyRate: number; latenessPenalty: number; overtimeMinutes?: number } | null>(null);
  const [overtime, setOvertime] = useState<Array<{ id: number; startAt: string; endAt: string; minutes: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasToday, setHasToday] = useState(false);
  const [beforeStart, setBeforeStart] = useState(false);
  const [afterEnd, setAfterEnd] = useState(false);
  const [startMinutes, setStartMinutes] = useState<number | null>(null);
  const [endMinutes, setEndMinutes] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const d = new Date();
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const [res, userRes] = await Promise.all([
      fetch(`/api/attendance/me?userId=${user.id}&month=${encodeURIComponent(monthStr)}`),
      fetch(`/api/users/${user.id}`),
    ]);
    const data = await res.json();
    const userData = userRes.ok ? await userRes.json() : {};
    if (res.ok) {
      setRecords(data.records || []);
      setTotals(data.totals || null);
      setOvertime(data.overtime || []);
      if (typeof userData.workStartMinutes === 'number') setStartMinutes(userData.workStartMinutes);
      if (typeof userData.workEndMinutes === 'number') setEndMinutes(userData.workEndMinutes);
      // detect today's Jakarta date exists
      try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })
          .formatToParts(now)
          .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
        const anchorISO = `${parts.year}-${parts.month}-${parts.day}`;
        const anchorDate = new Date(`${anchorISO}T00:00:00+07:00`);
        const found = (data.records || []).some((r: any) => {
          const rd = new Date(r.date);
          const rp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })
            .formatToParts(rd)
            .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
          const rISO = `${rp.year}-${rp.month}-${rp.day}`;
          return rISO === anchorISO;
        });
        setHasToday(found);
        // compute beforeStart based on user's scheduled start
        if (typeof userData.workStartMinutes === 'number') {
          const minutesSinceMidnight = Math.floor((now.getTime() - anchorDate.getTime()) / 60000);
          setBeforeStart(minutesSinceMidnight < userData.workStartMinutes);
          if (typeof userData.workEndMinutes === 'number') {
            setEndMinutes(userData.workEndMinutes);
            setAfterEnd(minutesSinceMidnight >= userData.workEndMinutes);
          } else {
            setAfterEnd(false);
          }
        } else {
          setBeforeStart(false);
          setAfterEnd(false);
        }
      } catch {}
    } else {
      setRecords([]);
      setTotals(null);
      setHasToday(false);
      setBeforeStart(false);
      setAfterEnd(false);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Re-evaluate beforeStart periodically so the button unlocks when time crosses
  useEffect(() => {
    if (startMinutes == null) return;
    const compute = () => {
      try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })
          .formatToParts(now)
          .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
        const anchorISO = `${parts.year}-${parts.month}-${parts.day}`;
        const anchorDate = new Date(`${anchorISO}T00:00:00+07:00`);
        const minutesSinceMidnight = Math.floor((now.getTime() - anchorDate.getTime()) / 60000);
        setBeforeStart(minutesSinceMidnight < startMinutes);
        if (endMinutes != null) setAfterEnd(minutesSinceMidnight >= endMinutes);
      } catch {
        // noop
      }
    };
    compute();
    const t = setInterval(compute, 30000); // update every 30s
    return () => clearInterval(t);
  }, [startMinutes, endMinutes]);

  const canAccess = hasAccess(user, "attendance");

  const handleClockIn = async () => {
    if (!user) return;
    const res = await fetch("/api/attendance/clock-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    if (res.ok) {
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
        <Button
          onClick={handleClockIn}
          disabled={hasToday || beforeStart || afterEnd}
          title={
            hasToday
              ? "Sudah clock in hari ini"
              : beforeStart && startMinutes != null
                ? `Bisa clock in mulai ${String(Math.floor(startMinutes/60)).padStart(2,'0')}:${String(startMinutes%60).padStart(2,'0')} WIB`
                : afterEnd && endMinutes != null
                  ? `Sudah lewat jam kerja (hingga ${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')} WIB)`
                  : undefined
          }
        >
          {hasToday ? "Sudah Clock In" : beforeStart ? "Belum Jam Masuk" : afterEnd ? "Sudah Lewat Jam Kerja" : "Clock In"}
        </Button>
        {(beforeStart && startMinutes != null) && (
          <div className="ml-3 text-xs text-amber-600">
            Bisa clock in mulai {String(Math.floor(startMinutes/60)).padStart(2,'0')}:{String(startMinutes%60).padStart(2,'0')} WIB
          </div>
        )}
        {(afterEnd && endMinutes != null) && (
          <div className="ml-3 text-xs text-amber-600">
            Sudah lewat jam kerja (hingga {String(Math.floor(endMinutes/60)).padStart(2,'0')}:{String(endMinutes%60).padStart(2,'0')} WIB)
          </div>
        )}
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

      <div className="overflow-x-auto">
      <Table className="min-w-[640px] md:min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal (Jakarta)</TableHead>
            <TableHead>Clock In (Jakarta)</TableHead>
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
                <TableCell className="text-right">{r.workedMinutes}</TableCell>
                <TableCell className="text-right">{r.latenessMinutes}</TableCell>
              </TableRow>
            );
          })}
          {!loading && records.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-gray-500">Belum ada data</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

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

      {/* Dialog removed: direct clock-in from header button */}
    </main>
  );
}
