import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse } from "../../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: any = {};
    if (from || to) {
      where.orderDate = {};
      if (from) where.orderDate.gte = new Date(from);
      if (to) where.orderDate.lte = new Date(to);
    }

    const rows = await withRetry(
      async () =>
        prisma.orderB2B.findMany({
          where,
          select: {
            id: true,
            outlet: true,
            orderDate: true,
            totalAmount: true,
            discount: true,
            location: true,
            items: {
              select: {
                id: true,
                quantity: true,
                price: true,
                product: { select: { name: true, code: true } },
              },
            },
          },
          orderBy: { orderDate: "desc" },
        }),
      2,
      "reports-b2b-fetch",
    );

    const totalOrders = rows.length;
    const totalAmount = rows.reduce((acc, r) => acc + (r.totalAmount || 0), 0);
    const byOutlet: Record<string, { count: number; total: number }> = {};
    for (const r of rows) {
      const key = r.outlet || "Unknown";
      byOutlet[key] ||= { count: 0, total: 0 };
      byOutlet[key].count += 1;
      byOutlet[key].total += r.totalAmount || 0;
    }

    return NextResponse.json({ rows, totalOrders, totalAmount, byOutlet });
  } catch (error) {
    return NextResponse.json(createErrorResponse("b2b report", error), { status: 500 });
  }
}
