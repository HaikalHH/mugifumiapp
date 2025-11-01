import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type YMonth = { y: number; m: number };
type Totals = { latenessMinutes: number; workedMinutes: number };

function parseMonth(q: string | null): YMonth | null {
  if (!q) return null;
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(q);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  if (y < 2000 || mm < 1 || mm > 12) return null;
  return { y, m: mm };
}

// Month range anchored to Jakarta local midnight so day-1 isn't excluded
function jakartaMonthRange({ y, m }: YMonth): { from: Date; to: Date } {
  const mm = String(m).padStart(2, "0");
  const from = new Date(`${y}-${mm}-01T00:00:00+07:00`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextMM = String(nextM).padStart(2, "0");
  const to = new Date(`${nextY}-${nextMM}-01T00:00:00+07:00`);
  return { from, to };
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = Number(url.searchParams.get("userId"));
    const monthStr = url.searchParams.get("month");
    if (!userId || !monthStr) return NextResponse.json({ error: "userId dan month wajib" }, { status: 400 });
    const parsed = parseMonth(monthStr);
    if (!parsed) return NextResponse.json({ error: "format month salah (YYYY-MM)" }, { status: 400 });
    const { y, m } = parsed;

    // Month range anchored in Jakarta, matching Attendance.date anchor
    const { from, to } = jakartaMonthRange({ y, m });

    // Load user first; needed for schedule and auto-close
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    // Tidak perlu persist "clock out". Perhitungan di bawah akan
    // menggunakan jam selesai terjadwal bila clockOutAt masih null.
    const scheduleEnd = user.workEndMinutes ?? 1020; // minutes from midnight Jakarta

    const [records, otApproved] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId, date: { gte: from, lt: to } },
        orderBy: { date: "asc" },
      }),
      prisma.overtimeRequest.findMany({
        where: { userId, startAt: { gte: from, lt: to }, status: "APPROVED" },
        orderBy: { startAt: "asc" },
      }),
    ]);

    const scheduleStart = user.workStartMinutes ?? 540;
    // scheduleEnd defined above
    const hourlyRate = user.overtimeHourlyRate ?? Math.floor((user.baseSalary || 0) / 160); // overtime
    const penaltyRate = Math.floor((user.baseSalary || 0) / 240); // penalty uses base/240

    const toleranceMs = 30 * 60 * 1000; // 30 minutes tolerance for lateness
    const data = records.map((r) => {
      const scheduledStartUTC = addMinutes(r.date, scheduleStart);
      const scheduledEndUTC = addMinutes(r.date, scheduleEnd);
      const effectiveStartUTC = new Date(scheduledStartUTC.getTime() + toleranceMs);

      const late = Math.max(0, Math.round((r.clockInAt.getTime() - effectiveStartUTC.getTime()) / 60000));
      const endCap = r.clockOutAt ? r.clockOutAt : new Date(Math.min(Date.now(), scheduledEndUTC.getTime()));
      const worked = Math.max(0, Math.round((endCap.getTime() - r.clockInAt.getTime()) / 60000));

      return { ...r, latenessMinutes: late, workedMinutes: worked };
    });

    const totals = data.reduce<Totals>((acc, it) => ({
      latenessMinutes: acc.latenessMinutes + it.latenessMinutes,
      workedMinutes: acc.workedMinutes + it.workedMinutes,
    }), { latenessMinutes: 0, workedMinutes: 0 });

    const overtime = otApproved.map((o) => ({
      id: o.id,
      startAt: o.startAt,
      endAt: o.endAt,
      minutes: Math.max(0, Math.round((o.endAt.getTime() - o.startAt.getTime()) / 60000)),
      status: o.status,
    }));
    const overtimeMinutes = overtime.reduce((s, x) => s + x.minutes, 0);

    // lateness penalty policy: first 120 minutes exempt per month; rest deducted pro-rata
    const excess = Math.max(0, totals.latenessMinutes - 120);
    const latenessPenalty = Math.round((excess * penaltyRate) / 60);

    return NextResponse.json({
      records: data,
      overtime,
      totals: { ...totals, overtimeMinutes, hourlyRate, penaltyRate, latenessPenalty },
    });
  } catch {
    return NextResponse.json({ error: "Gagal ambil attendance" }, { status: 500 });
  }
}
