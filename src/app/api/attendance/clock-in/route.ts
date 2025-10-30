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

    // Allow clock-in only within today's work window [start, end)
    const startMinutes = user.workStartMinutes ?? 540; // default 09:00
    const endMinutes = user.workEndMinutes ?? 1020;    // default 17:00
    const minutesSinceMidnightJakarta = Math.floor((now.getTime() - dateAnchor.getTime()) / 60000);
    if (minutesSinceMidnightJakarta < startMinutes) {
      const hh = String(Math.floor(startMinutes / 60)).padStart(2, "0");
      const mm = String(startMinutes % 60).padStart(2, "0");
      return NextResponse.json({ error: `Belum jam masuk (mulai ${hh}:${mm} WIB)` }, { status: 400 });
    }
    if (minutesSinceMidnightJakarta >= endMinutes) {
      const eh = String(Math.floor(endMinutes / 60)).padStart(2, "0");
      const em = String(endMinutes % 60).padStart(2, "0");
      return NextResponse.json({ error: `Sudah lewat jam kerja (hingga ${eh}:${em} WIB)` }, { status: 400 });
    }

    // Tidak perlu auto-close persist. Jika ada record sebelumnya open,
    // perhitungan attendance akan menganggap jam selesai sesuai jadwal.

    // Ensure only one attendance per Jakarta day
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
  } catch {
    return NextResponse.json({ error: "Gagal clock in" }, { status: 500 });
  }
}
