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

async function computeActualRevenue(startDate: Date, endDate: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      orderDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      actPayout: true,
      actualReceived: true,
      items: {
        select: { price: true },
      },
    },
  });

  return sales.reduce((sum, sale) => {
    const fromAct = normalizeAmount(sale.actPayout ?? null);
    const fromActualReceived = normalizeAmount(sale.actualReceived ?? null);
    const fromItems = sale.items.reduce((s, item) => s + normalizeAmount(item.price), 0);
    return sum + (fromAct || fromActualReceived || fromItems);
  }, 0);
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
        orderBy: [
          { year: "desc" },
          { month: "desc" },
        ],
        include: {
          plans: true,
          actuals: true,
        },
      });
    }, 2, "finance-report-periods");

    const reports: PeriodReport[] = [];
    for (const period of periods) {
      const actualRevenue = await withRetry(
        () => computeActualRevenue(period.startDate, period.endDate),
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
        name: period.name,
        month: period.month,
        year: period.year,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
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
