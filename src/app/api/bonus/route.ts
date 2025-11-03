import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const where: any = {};
    if (year) where.year = Number(year);
    if (month) where.month = Number(month);
    const rows = await prisma.userBonus.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch bonuses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { userId?: number; year?: number; month?: number; amount?: number; note?: string } | null;
    if (!body || !body.userId || !body.year || !body.month || !body.amount) {
      return NextResponse.json({ error: 'userId, year, month, amount are required' }, { status: 400 });
    }
    const created = await prisma.userBonus.create({
      data: {
        userId: Number(body.userId),
        year: Number(body.year),
        month: Number(body.month),
        amount: Math.round(Number(body.amount)),
        note: body.note?.trim() || undefined,
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create bonus' }, { status: 500 });
  }
}

