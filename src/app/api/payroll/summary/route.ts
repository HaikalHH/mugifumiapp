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
    const monthStr = url.searchParams.get("month");
    const parsed = parseMonth(monthStr);
    if (!parsed) return NextResponse.json({ error: "month (YYYY-MM) wajib" }, { status: 400 });
    const { y, m } = parsed;
    const from = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);
    const to = new Date(new Date(from).setUTCMonth(from.getUTCMonth() + 1));

    const [users, attendance, overtime, bonuses, manualPenalties] = await Promise.all([
      prisma.user.findMany({ orderBy: { id: "asc" } }),
      prisma.attendance.findMany({ where: { date: { gte: from, lt: to } } }),
      prisma.overtimeRequest.findMany({ where: { startAt: { gte: from, lt: to }, status: "APPROVED" } }),
      prisma.userBonus.findMany({ where: { year: y, month: m } }),
      prisma.manualPenalty.findMany({ where: { year: y, month: m } }),
    ]);

    const existingSnapshots = await prisma.payrollSnapshot.findMany({
      where: { year: y, month: m },
    });
    const snapshotMap = new Map(existingSnapshots.map((snap) => [snap.userId, snap]));

    const missingUsers = users.filter((u) => !snapshotMap.has(u.id));
    if (missingUsers.length > 0) {
      const payload = missingUsers.map((u) => {
        const baseSalary = u.baseSalary || 0;
        const hourlyRate = typeof u.overtimeHourlyRate === "number" ? u.overtimeHourlyRate : Math.floor(baseSalary / 160);
        const penaltyRate = Math.floor(baseSalary / 240);
        return {
          userId: u.id,
          year: y,
          month: m,
          baseSalary,
          hourlyRate,
          penaltyRate,
        };
      });
      await prisma.payrollSnapshot.createMany({
        data: payload,
        skipDuplicates: true,
      });
      if (payload.length) {
        const fresh = await prisma.payrollSnapshot.findMany({
          where: { year: y, month: m, userId: { in: payload.map((p) => p.userId) } },
        });
        for (const snap of fresh) {
          snapshotMap.set(snap.userId, snap);
        }
      }
    }

    const byUser: Record<number, any> = {};
    for (const u of users) {
      const snapshot = snapshotMap.get(u.id);
      const baseSalary = snapshot?.baseSalary ?? u.baseSalary ?? 0;
      const hourlyRate =
        snapshot?.hourlyRate ??
        (typeof u.overtimeHourlyRate === "number" ? u.overtimeHourlyRate : Math.floor(baseSalary / 160));
      const penaltyRate = snapshot?.penaltyRate ?? Math.floor(baseSalary / 240); // penalty uses base/240, independent of overtime rate
      byUser[u.id] = {
        user: { id: u.id, name: u.name, username: u.username, role: u.role, baseSalary, hourlyRate, penaltyRate },
        totals: { latenessMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 },
        penalty: 0, // lateness
        manualPenalty: 0,
        manualPenaltyDetails: [] as Array<{ amount: number; reason: string | null }>,
        overtimePay: 0,
        netSalary: baseSalary,
        bonus: 0,
      };
    }
    for (const a of attendance) {
      const u = byUser[a.userId];
      if (!u) continue;
      const user = users.find((x) => x.id === a.userId)!;
      const scheduleStart = user.workStartMinutes ?? 540;
      const scheduleEnd = user.workEndMinutes ?? 1020;
      const scheduledStartUTC = new Date(a.date.getTime() + scheduleStart * 60000);
      const scheduledEndUTC = new Date(a.date.getTime() + scheduleEnd * 60000);
      const toleranceMs = 30 * 60 * 1000; // 30 minutes tolerance for lateness
      const effectiveStartUTC = new Date(scheduledStartUTC.getTime() + toleranceMs);
      const late = Math.max(0, Math.round((a.clockInAt.getTime() - effectiveStartUTC.getTime()) / 60000));
      const endCap = a.clockOutAt ? a.clockOutAt : new Date(Math.min(Date.now(), scheduledEndUTC.getTime()));
      const worked = Math.max(0, Math.round((endCap.getTime() - a.clockInAt.getTime()) / 60000));
      u.totals.latenessMinutes += late;
      u.totals.workedMinutes += worked;
    }
    for (const o of overtime) {
      const u = byUser[o.userId];
      if (!u) continue;
      const mins = Math.max(0, Math.round((o.endAt.getTime() - o.startAt.getTime()) / 60000));
      u.totals.overtimeMinutes += mins;
    }
    for (const idStr of Object.keys(byUser)) {
      const v = byUser[Number(idStr)];
      const exempt = 120;
      const excess = Math.max(0, v.totals.latenessMinutes - exempt);
      v.penalty = Math.round((excess * v.user.penaltyRate) / 60);
      v.overtimePay = Math.round((v.totals.overtimeMinutes * v.user.hourlyRate) / 60);
      v.netSalary = Math.max(0, v.user.baseSalary - v.penalty + v.overtimePay);
    }
    // Attach monthly bonus per user (not included in netSalary)
    for (const b of bonuses) {
      const u = byUser[b.userId];
      if (u) u.bonus = (u.bonus || 0) + (b.amount || 0);
    }
    // Attach manual penalties
    for (const p of manualPenalties) {
      const u = byUser[p.userId];
      if (!u) continue;
      u.manualPenalty += p.amount || 0;
      u.manualPenaltyDetails.push({ amount: p.amount || 0, reason: p.reason || null });
    }
    // Recompute net salary with manual penalties
    for (const idStr of Object.keys(byUser)) {
      const v = byUser[Number(idStr)];
      const totalPenalty = (v.penalty || 0) + (v.manualPenalty || 0);
      v.netSalary = Math.max(0, v.user.baseSalary - totalPenalty + v.overtimePay);
    }
    const overtimeDetails = overtime.map((o) => {
      const mins = Math.max(0, Math.round((o.endAt.getTime() - o.startAt.getTime()) / 60000));
      const user = byUser[o.userId]?.user;
      const hourlyRate = user?.hourlyRate ?? 0;
      return {
        id: o.id,
        userId: o.userId,
        userName: user?.name ?? `User #${o.userId}`,
        startAt: o.startAt,
        endAt: o.endAt,
        minutes: mins,
        pay: Math.round((mins * hourlyRate) / 60),
      };
    });

    return NextResponse.json({
      month: `${y}-${String(m).padStart(2, "0")}`,
      users: Object.values(byUser),
      overtimeDetails,
    });
  } catch (error) {
    return NextResponse.json({ error: "Gagal membuat ringkasan payroll" }, { status: 500 });
  }
}
