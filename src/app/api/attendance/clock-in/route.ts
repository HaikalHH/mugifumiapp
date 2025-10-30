import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

function getJakartaDateAnchorUTC(now: Date): Date {
  // Compute Jakarta local date start at 00:00 and return as UTC Date
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(now).reduce<Record<string,string>>((acc, p) => { if (p.type !== "literal") acc[p.type] = p.value; return acc; }, {});
  const y = parts.year, m = parts.month, d = parts.day;
  // Interpret this local date as midnight in Jakarta, then convert to UTC by creating ISO string with TZ
  // Easiest: make a Date from `${y}-${m}-${d}T00:00:00+07:00` then to UTC date
  const dt = new Date(`${y}-${m}-${d}T00:00:00+07:00`);
  return dt; // JS Date is UTC internally
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId wajib" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    const now = new Date();
    const dateAnchor = getJakartaDateAnchorUTC(now);

    // Auto-close any open attendance whose scheduled end has passed
    const openList = await prisma.attendance.findMany({
      where: { userId: user.id, clockOutAt: null },
      orderBy: { clockInAt: "asc" },
    });
    for (const att of openList) {
      const endMinutes = user.workEndMinutes ?? 1020; // default 17:00 Jakarta
      const scheduledEndUTC = new Date(att.date.getTime() + endMinutes * 60 * 1000);
      if (now.getTime() >= scheduledEndUTC.getTime()) {
        await prisma.attendance.update({ where: { id: att.id }, data: { clockOutAt: scheduledEndUTC } });
      }
    }

    // Ensure no open attendance for today
    // Prevent multiple attendance entries for the same Jakarta day (even if already closed)
    const todayAny = await prisma.attendance.findFirst({
      where: { userId: user.id, date: dateAnchor },
      orderBy: { clockInAt: "desc" },
    });
    if (todayAny) return NextResponse.json(todayAny);

    const att = await prisma.attendance.create({
      data: {
        userId: user.id,
        date: dateAnchor,
        clockInAt: now,
      },
    });
    return NextResponse.json(att);
  } catch (error) {
    return NextResponse.json({ error: "Gagal clock in" }, { status: 500 });
  }
}
