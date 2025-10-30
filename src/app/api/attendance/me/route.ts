import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

function parseMonth(q: string | null): { y: number; m: number } | null {
  if (!q) return null;
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(q);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  if (y < 2000 || mm < 1 || mm > 12) return null;
  return { y, m: mm };
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

    // month range in UTC (Jakarta-anchored days handled via Attendance.date which is midnight Jakarta in UTC)
    const from = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);
    const to = new Date(new Date(from).setUTCMonth(from.getUTCMonth() + 1));

    const [user, records, otApproved] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.attendance.findMany({
        where: { userId, date: { gte: from, lt: to } },
        orderBy: { date: "asc" },
      }),
      prisma.overtimeRequest.findMany({
        where: { userId, startAt: { gte: from, lt: to }, status: "APPROVED" },
        orderBy: { startAt: "asc" },
      }),
    ]);
    if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    const scheduleStart = user.workStartMinutes ?? 540;
    const scheduleEnd = user.workEndMinutes ?? 1020;
    const hourlyRate = user.overtimeHourlyRate ?? Math.floor((user.baseSalary || 0) / 160); // overtime
    const penaltyRate = Math.floor((user.baseSalary || 0) / 240); // penalty uses base/240

    const data = records.map((r) => {
      const scheduledStartUTC = new Date(r.date.getTime() + scheduleStart * 60 * 1000);
      const scheduledEndUTC = new Date(r.date.getTime() + scheduleEnd * 60 * 1000);
      const toleranceMs = 30 * 60 * 1000; // 30 minutes tolerance for lateness
      const effectiveStartUTC = new Date(scheduledStartUTC.getTime() + toleranceMs);
      const latenessMinutes = Math.max(0, Math.round((r.clockInAt.getTime() - effectiveStartUTC.getTime()) / 60000));
      let workedMinutes = 0;
      if (r.clockOutAt) {
        workedMinutes = Math.max(0, Math.round((r.clockOutAt.getTime() - r.clockInAt.getTime()) / 60000));
      } else {
        const cap = new Date(Math.min(Date.now(), scheduledEndUTC.getTime()));
        workedMinutes = Math.max(0, Math.round((cap.getTime() - r.clockInAt.getTime()) / 60000));
      }
      return {
        ...r,
        latenessMinutes,
        workedMinutes,
      };
    });

    const totals = data.reduce(
      (acc, it) => {
        acc.latenessMinutes += it.latenessMinutes;
        acc.workedMinutes += it.workedMinutes;
        return acc;
      },
      { latenessMinutes: 0, workedMinutes: 0 },
    );

    const overtime = otApproved.map((o) => {
      const minutes = Math.max(0, Math.round((o.endAt.getTime() - o.startAt.getTime()) / 60000));
      return {
        id: o.id,
        startAt: o.startAt,
        endAt: o.endAt,
        minutes,
        status: o.status,
      };
    });
    const overtimeMinutes = overtime.reduce((s, x) => s + x.minutes, 0);

    // lateness penalty policy: first 120 minutes exempt per month; rest deducted pro-rata
    const excess = Math.max(0, totals.latenessMinutes - 120);
    const latenessPenalty = Math.round((excess * penaltyRate) / 60);

    return NextResponse.json({
      records: data,
      overtime,
      totals: { ...totals, overtimeMinutes, hourlyRate, penaltyRate, latenessPenalty },
    });
  } catch (error) {
    return NextResponse.json({ error: "Gagal ambil attendance" }, { status: 500 });
  }
}
