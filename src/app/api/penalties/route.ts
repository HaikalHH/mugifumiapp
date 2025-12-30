import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createErrorResponse, logRouteComplete, logRouteStart, withRetry } from "../../../lib/db-utils";

function parseMonth(q: string | null): { y: number; m: number } | null {
  if (!q) return null;
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(q);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  if (y < 2000 || mm < 1 || mm > 12) return null;
  return { y, m: mm };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseMonth(searchParams.get("month"));
    if (!parsed) return NextResponse.json({ error: "month (YYYY-MM) wajib" }, { status: 400 });
    const { y, m } = parsed;

    logRouteStart("penalties-list", { y, m });

    const rows = await withRetry(async () => {
      return prisma.manualPenalty.findMany({
        where: { year: y, month: m },
        orderBy: { id: "desc" },
        select: {
          id: true,
          userId: true,
          year: true,
          month: true,
          amount: true,
          reason: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, username: true, role: true }
          }
        }
      });
    }, 2, "penalties-list");

    logRouteComplete("penalties-list", rows.length);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(createErrorResponse("fetch penalties", error), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, reason, month } = body as { userId?: number; amount?: number; reason?: string; month?: string };

    const parsed = parseMonth(month || null);
    if (!parsed) return NextResponse.json({ error: "month (YYYY-MM) wajib" }, { status: 400 });
    const { y, m } = parsed;

    if (!userId || !Number.isFinite(userId)) return NextResponse.json({ error: "userId wajib" }, { status: 400 });
    if (!amount || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount harus > 0" }, { status: 400 });

    logRouteStart("penalties-create", { userId, amount, y, m });

    const created = await withRetry(async () => {
      return prisma.manualPenalty.create({
        data: {
          userId,
          amount: Math.round(amount),
          reason: reason?.trim() || null,
          year: y,
          month: m,
        },
        select: {
          id: true,
          userId: true,
          year: true,
          month: true,
          amount: true,
          reason: true,
          createdAt: true,
        }
      });
    }, 2, "penalties-create");

    logRouteComplete("penalties-create", 1);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(createErrorResponse("create penalty", error), { status: 500 });
  }
}
