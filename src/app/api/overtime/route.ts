import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

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
    const all = url.searchParams.get("all") === "true";
    const monthStr = url.searchParams.get("month");
    if (!monthStr) return NextResponse.json({ error: "month wajib" }, { status: 400 });
    const parsed = parseMonth(monthStr);
    if (!parsed) return NextResponse.json({ error: "format month salah (YYYY-MM)" }, { status: 400 });
    const { y, m } = parsed;
    const from = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);
    const to = new Date(new Date(from).setUTCMonth(from.getUTCMonth() + 1));

    const where: any = { startAt: { gte: from, lt: to } };
    if (!all) where.userId = userId;

    const items = await prisma.overtimeRequest.findMany({ where, orderBy: { startAt: "asc" } });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: "Gagal ambil data lembur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, startAt, endAt } = await req.json();
    if (!userId || !startAt || !endAt) return NextResponse.json({ error: "userId, startAt, endAt wajib" }, { status: 400 });
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(start.getTime() < end.getTime())) return NextResponse.json({ error: "endAt harus setelah startAt" }, { status: 400 });
    const reqItem = await prisma.overtimeRequest.create({ data: { userId: Number(userId), startAt: start, endAt: end } });
    return NextResponse.json(reqItem, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Gagal membuat lembur" }, { status: 500 });
  }
}

