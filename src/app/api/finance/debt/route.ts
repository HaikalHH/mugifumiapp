import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse } from "../../../../lib/db-utils";

type SummaryRow = {
  periodId: number;
  weekId: number | null;
  weekName: string;
  startDate: string;
  endDate: string;
  totalActual: number;
  totalOmsetPaid: number;
  pinjamModal: number;
  totalPaid: number;
  remaining: number;
};

function normalizeOrderStatus(rawStatus?: string | null): "PAID" | "NOT PAID" {
  if (!rawStatus) return "PAID";
  const normalized = String(rawStatus).trim().toUpperCase();
  if (normalized === "NOT PAID" || normalized === "NOT_PAID") return "NOT PAID";
  return "PAID";
}

function needsDiscount(outlet: string) {
  const key = outlet.toLowerCase();
  return key === "whatsapp" || key === "cafe" || key === "wholesale";
}

function computeActualAmount(order: {
  outlet: string;
  discount?: number | null;
  totalAmount?: number | null;
  actPayout?: number | null;
  ongkirPlan?: number | null;
  items?: Array<{ price: number; quantity: number }>;
  deliveries?: Array<{ ongkirPlan: number | null; ongkirActual: number | null; status: string }>;
}) {
  const orderItems = order.items || [];
  const preDiscountSubtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const outletKey = order.outlet.toLowerCase();
  const isFree = outletKey === "free";
  const isCafe = outletKey === "cafe";
  const isWhatsApp = outletKey === "whatsapp";
  const discountPct = needsDiscount(order.outlet) && typeof order.discount === "number" ? order.discount : 0;
  const discountedSubtotal = Math.round(preDiscountSubtotal * (1 - (discountPct || 0) / 100));
  const planOngkirValue = order.ongkirPlan || 0;

  let ongkirDifference = 0;
  if (isWhatsApp && order.deliveries && order.deliveries.length > 0) {
    for (const delivery of order.deliveries) {
      if (delivery.ongkirPlan && delivery.ongkirActual && delivery.status === "delivered") {
        const diff = delivery.ongkirActual - delivery.ongkirPlan;
        if (diff > 0) {
          ongkirDifference += diff;
        }
      }
    }
  }

  const resolvedActual = order.actPayout != null
    ? order.actPayout
    : (order.totalAmount != null ? order.totalAmount : null);

  let actualAmount = 0;
  if (isFree) {
    actualAmount = 0;
  } else if (isCafe) {
    actualAmount = order.actPayout ?? 0;
  } else if (isWhatsApp) {
    const baseTotal = order.totalAmount != null ? order.totalAmount : discountedSubtotal + planOngkirValue;
    const goodsValue = Math.max(0, baseTotal - planOngkirValue);
    actualAmount = Math.max(0, goodsValue - Math.max(0, ongkirDifference));
  } else {
    actualAmount = resolvedActual ?? 0;
  }

  return actualAmount;
}

// Compute Total Omset Diterima (PAID) for a given date range using same logic as metrics route
async function computeTotalOmsetPaid(from: Date, to: Date): Promise<number> {
  const orders = await withRetry(async () => {
    return prisma.order.findMany({
      where: { orderDate: { gte: from, lte: to } },
      select: {
        outlet: true,
        status: true,
        customer: true,
        discount: true,
        actPayout: true,
        totalAmount: true,
        ongkirPlan: true,
        items: { select: { price: true, quantity: true } },
        deliveries: { select: { ongkirPlan: true, ongkirActual: true, status: true } },
      },
    });
  }, 2, "finance-debt-orders");

  let totalOmsetPaid = 0;
  for (const order of orders) {
    if (normalizeOrderStatus(order.status) === "NOT PAID") {
      continue;
    }
    const actualAmount = computeActualAmount(order);
    if (actualAmount > 0) {
      totalOmsetPaid += actualAmount;
    }
  }

  return totalOmsetPaid;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodIdRaw = searchParams.get("periodId");

    if (periodIdRaw) {
      const periodId = Number(periodIdRaw);
      if (Number.isNaN(periodId)) {
        return NextResponse.json({ error: "periodId must be a number" }, { status: 400 });
      }

      const period = await prisma.financePeriod.findUnique({
        where: { id: periodId },
        include: { week: true, actuals: true },
      });
      if (!period) {
        return NextResponse.json({ error: "Finance period not found" }, { status: 404 });
      }

      const from = new Date(period.startDate);
      const to = new Date(period.endDate);
      const totalActual = period.actuals.reduce((sum, a) => sum + a.amount, 0);
      const totalOmsetPaid = await computeTotalOmsetPaid(from, to);
      const pinjamModal = Math.max(totalActual - totalOmsetPaid, 0);

      const payments = await prisma.financeDebtPayment.findMany({
        where: { periodId },
        orderBy: { term: "asc" },
      });
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(pinjamModal - totalPaid, 0);

      return NextResponse.json({
        period: {
          id: period.id,
          name: period.name,
          weekId: period.weekId,
          week: period.week ? {
            id: period.week.id,
            name: period.week.name,
            startDate: period.week.startDate,
            endDate: period.week.endDate,
          } : null,
          startDate: period.startDate,
          endDate: period.endDate,
        },
        totals: { totalActual, totalOmsetPaid, pinjamModal, totalPaid, remaining },
        payments: payments.map((p) => ({
          id: p.id,
          term: p.term,
          amount: p.amount,
          note: p.note || null,
          createdAt: p.createdAt,
        })),
      });
    }

    // Summary for all periods with a week
    const periods = await prisma.financePeriod.findMany({
      where: { weekId: { not: null } },
      include: { week: true, actuals: true },
      orderBy: { startDate: "desc" },
    });

    const rows: SummaryRow[] = [];
    for (const period of periods) {
      const from = new Date(period.startDate);
      const to = new Date(period.endDate);
      const totalActual = period.actuals.reduce((sum, a) => sum + a.amount, 0);
      const totalOmsetPaid = await computeTotalOmsetPaid(from, to);
      const pinjamModal = Math.max(totalActual - totalOmsetPaid, 0);
      const paid = await prisma.financeDebtPayment.aggregate({
        _sum: { amount: true },
        where: { periodId: period.id },
      });
      const totalPaid = paid._sum.amount || 0;
      const remaining = Math.max(pinjamModal - totalPaid, 0);
      rows.push({
        periodId: period.id,
        weekId: period.weekId || null,
        weekName: period.week ? period.week.name : period.name,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        totalActual,
        totalOmsetPaid,
        pinjamModal,
        totalPaid,
        remaining,
      });
    }

    const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);
    return NextResponse.json({ totalRemaining, rows });
  } catch (error) {
    return NextResponse.json(createErrorResponse("fetch finance debt", error), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { periodId?: number; amount?: number; note?: string } | null;
    if (!body || !body.periodId || !body.amount) {
      return NextResponse.json({ error: "periodId and amount are required" }, { status: 400 });
    }
    const periodId = Number(body.periodId);
    const amount = Math.round(Number(body.amount));
    const note = body.note?.trim() || undefined;
    if (!Number.isFinite(periodId) || periodId <= 0 || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid periodId or amount" }, { status: 400 });
    }

    const count = await prisma.financeDebtPayment.count({ where: { periodId } });
    const term = count + 1;
    const created = await prisma.financeDebtPayment.create({
      data: { periodId, amount, note, term },
    });
    return NextResponse.json({ id: created.id, term: created.term, amount: created.amount, note: created.note || null, createdAt: created.createdAt });
  } catch (error) {
    return NextResponse.json(createErrorResponse("create finance debt payment", error), { status: 500 });
  }
}
