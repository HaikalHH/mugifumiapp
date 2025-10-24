import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { FinanceCategory } from "@prisma/client";

type MetricsResponse = {
  actualRevenueByOutlet: Array<{ outlet: string; amount: number }>;
  actualRevenueTotal: number;
  bahanBudget: number;
  totalOmsetPaid: number;
  danaTertahan: Array<{ outlet: string; amount: number }>;
  totalPlanAmount: number;
  planEntries: Array<{
    id: number;
    category: FinanceCategory;
    amount: number;
    data: any;
    createdAt: string;
    updatedAt: string;
  }>;
  totalActualSpent: number;
  actualEntries: Array<{
    id: number;
    category: FinanceCategory;
    amount: number;
    data: any;
    createdAt: string;
    updatedAt: string;
  }>;
  netMargin: number;
  pinjamModal: number;
};

function parseDate(input: string | null, fallback: Date): Date {
  if (!input) return fallback;
  const date = new Date(input);
  if (isNaN(date.getTime())) return fallback;
  return date;
}

function normalizeAmount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultTo = now;
    const from = parseDate(searchParams.get("from"), defaultFrom);
    const to = parseDate(searchParams.get("to"), defaultTo);
    const periodIdRaw = searchParams.get("periodId");
    const periodId = periodIdRaw ? Number(periodIdRaw) : null;

    logRouteStart("finance-metrics", { from: from.toISOString(), to: to.toISOString(), periodId });

    // Fetch sales data for actual revenue
    const sales = await withRetry(async () => {
      return prisma.sale.findMany({
        where: {
          orderDate: {
            gte: from,
            lte: to,
          },
        },
        select: {
          outlet: true,
          actPayout: true,
          actualReceived: true,
          items: {
            select: {
              price: true,
            },
          },
        },
      });
    }, 2, "finance-metrics-sales");

    const actualRevenueMap = new Map<string, number>();
    for (const sale of sales) {
      const fromAct = normalizeAmount(sale.actPayout ?? null);
      const fromActualReceived = normalizeAmount(sale.actualReceived ?? null);
      const fromItems = sale.items.reduce((sum, item) => sum + normalizeAmount(item.price), 0);
      const amount = fromAct || fromActualReceived || fromItems;
      const current = actualRevenueMap.get(sale.outlet) ?? 0;
      actualRevenueMap.set(sale.outlet, current + amount);
    }

    const actualRevenueByOutlet = Array.from(actualRevenueMap.entries())
      .map(([outlet, amount]) => ({ outlet, amount }))
      .sort((a, b) => a.outlet.localeCompare(b.outlet));
    const actualRevenueTotal = actualRevenueByOutlet.reduce((sum, row) => sum + row.amount, 0);

    // Compute bahan budget from order items using product.hppValue
    const bahanBudget = await withRetry(async () => {
      const rows = await prisma.orderItem.findMany({
        where: {
          order: {
            orderDate: {
              gte: from,
              lte: to,
            },
          },
        },
        select: {
          quantity: true,
          product: {
            select: {
              hppValue: true,
            },
          },
        },
      });
      return rows.reduce((sum, row) => {
        const hpp = normalizeAmount(row.product?.hppValue ?? null);
        const qty = typeof row.quantity === "number" ? row.quantity : 0;
        return sum + hpp * qty;
      }, 0);
    }, 2, "finance-metrics-bahan-budget");

    // Total omset diterima (orders with status = PAID)
    const totalOmsetPaid = await withRetry(async () => {
      const aggregate = await prisma.order.aggregate({
        where: {
          status: "PAID",
          orderDate: {
            gte: from,
            lte: to,
          },
        },
        _sum: {
          totalAmount: true,
        },
      });
      return normalizeAmount(aggregate._sum.totalAmount);
    }, 2, "finance-metrics-total-omset-paid");

    // Dana tertahan (orders status = NOT PAID grouped by outlet)
    const danaTertahan = await withRetry(async () => {
      const groups = await prisma.order.groupBy({
        by: ["outlet"],
        where: {
          status: "NOT PAID",
          orderDate: {
            gte: from,
            lte: to,
          },
        },
        _sum: {
          totalAmount: true,
        },
      });
      return groups
        .map((row) => ({
          outlet: row.outlet,
          amount: normalizeAmount(row._sum.totalAmount),
        }))
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount);
    }, 2, "finance-metrics-dana-tertahan");

    // Fetch plan & actual entries if period requested
    let planEntries: MetricsResponse["planEntries"] = [];
    let totalPlanAmount = 0;
    let actualEntries: MetricsResponse["actualEntries"] = [];
    let totalActualSpent = 0;

    if (periodId) {
      const [planRows, actualRows] = await withRetry(async () => {
        return prisma.$transaction([
          prisma.financePlanEntry.findMany({
            where: { periodId },
            orderBy: { category: "asc" },
          }),
          prisma.financeActualEntry.findMany({
            where: { periodId },
            orderBy: { category: "asc" },
          }),
        ]);
      }, 2, "finance-metrics-plan-actual");

      planEntries = planRows.map((row) => ({
        id: row.id,
        category: row.category,
        amount: row.amount,
        data: row.data,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
      totalPlanAmount = planEntries.reduce((sum, row) => sum + row.amount, 0);

      actualEntries = actualRows.map((row) => ({
        id: row.id,
        category: row.category,
        amount: row.amount,
        data: row.data,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
      totalActualSpent = actualEntries.reduce((sum, row) => sum + row.amount, 0);
    }

    const netMargin = actualRevenueTotal - totalPlanAmount;
    const pinjamModalGap = totalOmsetPaid - totalPlanAmount;
    const pinjamModal = pinjamModalGap < 0 ? Math.abs(pinjamModalGap) : 0;

    const payload: MetricsResponse = {
      actualRevenueByOutlet,
      actualRevenueTotal,
      bahanBudget,
      totalOmsetPaid,
      danaTertahan,
      totalPlanAmount,
      planEntries,
      totalActualSpent,
      actualEntries,
      netMargin,
      pinjamModal,
    };

    logRouteComplete("finance-metrics", payload.actualRevenueByOutlet.length);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch finance metrics", error),
      { status: 500 },
    );
  }
}
