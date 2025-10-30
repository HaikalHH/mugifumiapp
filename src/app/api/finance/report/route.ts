import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { FinanceCategory } from "@prisma/client";

type CategorySummary = {
  category: FinanceCategory;
  amount: number;
  data: any[];
};

type PeriodReport = {
  periodId: number;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  weekId: number | null;
  week: {
    id: number;
    name: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  } | null;
  actualRevenue: number;
  plan: {
    total: number;
    byCategory: CategorySummary[];
  };
  actual: {
    total: number;
    byCategory: CategorySummary[];
  };
  netProfitPlan: number;
  netProfitActual: number;
};

function normalizeAmount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}

function mapWeek(
  week: { id: number; name: string; month: number; year: number; startDate: Date; endDate: Date } | null,
) {
  if (!week) return null;
  return {
    id: week.id,
    name: week.name,
    month: week.month,
    year: week.year,
    startDate: week.startDate.toISOString(),
    endDate: week.endDate.toISOString(),
  };
}

async function computeActualRevenue(startDate: Date, endDate: Date) {
  // Use orders as the single source of truth (consistent with finance metrics and sales reports)
  const orders = await prisma.order.findMany({
    where: {
      orderDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      outlet: true,
      status: true,
      actPayout: true,
      totalAmount: true,
      items: { select: { price: true, quantity: true } },
      deliveries: { select: { ongkirPlan: true, ongkirActual: true, status: true } },
    },
  });

  let total = 0;
  for (const order of orders) {
    const outletLower = order.outlet.toLowerCase();
    const isFree = outletLower === "free";
    const isCafe = outletLower === "cafe";
    const isWhatsApp = outletLower === "whatsapp";

    // Pre-discount subtotal in case totalAmount is missing
    const preDiscountSubtotal = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 0)), 0);
    const totalAmount = order.totalAmount || preDiscountSubtotal;

    // Calculate ongkir difference for WhatsApp
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

    // Actual revenue per order mirrors logic in finance metrics/report sales
    const actual = isFree
      ? 0
      : (isCafe
        ? (order.actPayout ?? 0)
        : (isWhatsApp
          ? ((order.actPayout || totalAmount || 0) - ongkirDifference)
          : (order.actPayout || totalAmount || 0)));

    total += normalizeAmount(actual);
  }

  return total;
}

function summarizeEntries(entries: Array<{ category: FinanceCategory; amount: number; data: any }>): { total: number; byCategory: CategorySummary[] } {
  const map = new Map<FinanceCategory, { amount: number; data: any[] }>();
  for (const entry of entries) {
    const current = map.get(entry.category) ?? { amount: 0, data: [] as any[] };
    current.amount += entry.amount;
    if (entry.data) current.data.push(entry.data);
    map.set(entry.category, current);
  }
  const byCategory = Array.from(map.entries()).map(([category, value]) => ({
    category,
    amount: value.amount,
    data: value.data,
  }));
  const total = byCategory.reduce((sum, row) => sum + row.amount, 0);
  return { total, byCategory };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearRaw = searchParams.get("year");
    const yearFilter = yearRaw ? Number(yearRaw) : null;
    if (yearFilter !== null && Number.isNaN(yearFilter)) {
      return NextResponse.json({ error: "year must be a number" }, { status: 400 });
    }

    logRouteStart("finance-report", { yearFilter });

    const periods = await withRetry(async () => {
      return prisma.financePeriod.findMany({
        where: yearFilter === null ? undefined : { year: yearFilter },
        orderBy: [{ startDate: "desc" }],
        include: {
          plans: true,
          actuals: true,
          week: true,
        },
      });
    }, 2, "finance-report-periods");

    const reports: PeriodReport[] = [];
    for (const period of periods) {
      const weekStart = period.week?.startDate ?? period.startDate;
      const weekEnd = period.week?.endDate ?? period.endDate;
      const weekInfo = period.week ?? null;

      const actualRevenue = await withRetry(
        () => computeActualRevenue(weekStart, weekEnd),
        2,
        `finance-report-actual-revenue-${period.id}`,
      );

      const planSummary = summarizeEntries(period.plans.map((entry) => ({
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
      })));
      const actualSummary = summarizeEntries(period.actuals.map((entry) => ({
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
      })));

      reports.push({
        periodId: period.id,
        name: period.name || weekInfo?.name || `Periode ${period.id}`,
        month: weekInfo?.month ?? weekStart.getMonth() + 1,
        year: weekInfo?.year ?? weekStart.getFullYear(),
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        weekId: period.weekId ?? null,
        week: mapWeek(weekInfo),
        actualRevenue,
        plan: planSummary,
        actual: actualSummary,
        netProfitPlan: actualRevenue - planSummary.total,
        netProfitActual: actualRevenue - actualSummary.total,
      });
    }

    logRouteComplete("finance-report", reports.length);
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch finance report", error),
      { status: 500 },
    );
  }
}
