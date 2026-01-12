import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { FinanceCategory } from "@prisma/client";

type MetricsResponse = {
  actualRevenueByOutlet: Array<{ outlet: string; amount: number; totalAmount: number; discountPct: number }>;
  actualRevenueByOutletRegion: Array<{ outletRegion: string; amount: number; totalAmount: number; discountPct: number }>;
  actualRevenueTotal: number;
  bahanBudget: number;
  totalOmsetPaid: number;
  totalOmsetPaidByOutlet: Array<{ outlet: string; amount: number }>;
  danaTertahan: Array<{ outlet: string; amount: number }>;
  danaTertahanTotal: number;
  danaTertahanDetails: Array<{ outlet: string; entries: Array<{ customer: string; amount: number; location: string }> }>;
  totalPlanAmount: number;
  planEntries: Array<{
    id: number;
    category: FinanceCategory;
    amount: number;
    data: unknown;
    createdAt: string;
    updatedAt: string;
  }>;
  totalActualSpent: number;
  actualEntries: Array<{
    id: number;
    category: FinanceCategory;
    amount: number;
    data: unknown;
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

  return { actualAmount, preDiscountSubtotal };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultTo = now;
    const weekIdRaw = searchParams.get("weekId");
    const periodIdRaw = searchParams.get("periodId");
    const periodId = periodIdRaw ? Number(periodIdRaw) : null;

    let from: Date;
    let to: Date;
    let weekInfo: { id: number; name: string; startDate: Date; endDate: Date } | null = null;

    if (weekIdRaw) {
      const weekId = Number(weekIdRaw);
      if (Number.isNaN(weekId)) {
        return NextResponse.json({ error: "weekId must be a number" }, { status: 400 });
      }
      weekInfo = await withRetry(
        () => prisma.financeWeek.findUnique({ where: { id: weekId } }),
        2,
        "finance-metrics-week",
      );
      if (!weekInfo) {
        return NextResponse.json({ error: "Finance week not found" }, { status: 404 });
      }
      from = new Date(weekInfo.startDate);
      to = new Date(weekInfo.endDate);
    } else {
      from = parseDate(searchParams.get("from"), defaultFrom);
      to = parseDate(searchParams.get("to"), defaultTo);
    }

    logRouteStart("finance-metrics", {
      from: from.toISOString(),
      to: to.toISOString(),
      periodId,
      weekId: weekInfo?.id ?? null,
    });

    // Fetch orders data for actual revenue
    const orders = await withRetry(async () => {
      return prisma.order.findMany({
        where: {
          orderDate: {
            gte: from,
            lte: to,
          },
        },
        select: {
          outlet: true,
          location: true,
          status: true,
          customer: true,
          discount: true,
          actPayout: true,
          totalAmount: true,
          ongkirPlan: true,
          items: {
            select: {
              price: true,
              quantity: true,
            },
          },
          deliveries: {
            select: {
              ongkirPlan: true,
              ongkirActual: true,
              status: true,
            },
          },
        },
      });
    }, 2, "finance-metrics-orders");

    const actualRevenueMap = new Map<string, number>();
    const totalAmountMap = new Map<string, number>();
    const actualRevenueByOutletRegionMap = new Map<string, number>();
    const totalAmountByOutletRegionMap = new Map<string, number>();
    
    for (const order of orders) {
      const { actualAmount, preDiscountSubtotal } = computeActualAmount(order);

      // For actualRevenueByOutlet, we want total revenue (both paid and unpaid)
      const currentTotal = actualRevenueMap.get(order.outlet) || 0;
      actualRevenueMap.set(order.outlet, currentTotal + actualAmount);

      const currentTotalAmount = totalAmountMap.get(order.outlet) || 0;
      totalAmountMap.set(order.outlet, currentTotalAmount + preDiscountSubtotal);

      // For actualRevenueByOutletRegion
      const regionKey = `${order.outlet} ${order.location}`.trim();
      const currentRegionTotal = actualRevenueByOutletRegionMap.get(regionKey) || 0;
      actualRevenueByOutletRegionMap.set(regionKey, currentRegionTotal + actualAmount);

      const currentRegionTotalAmount = totalAmountByOutletRegionMap.get(regionKey) || 0;
      totalAmountByOutletRegionMap.set(regionKey, currentRegionTotalAmount + preDiscountSubtotal);
    }

    const actualRevenueByOutlet = Array.from(actualRevenueMap.entries())
      .map(([outlet, amount]) => {
        const preDiscountSubtotal = totalAmountMap.get(outlet) || 0;
        const discountPct = preDiscountSubtotal > 0 ? Math.round(((preDiscountSubtotal - amount) / preDiscountSubtotal) * 1000) / 10 : 0;
        return { outlet, amount, totalAmount: preDiscountSubtotal, discountPct };
      })
      .sort((a, b) => a.outlet.localeCompare(b.outlet));
    
    const actualRevenueByOutletRegion = Array.from(actualRevenueByOutletRegionMap.entries())
      .map(([outletRegion, amount]) => {
        const preDiscountSubtotal = totalAmountByOutletRegionMap.get(outletRegion) || 0;
        const discountPct = preDiscountSubtotal > 0 ? Math.round(((preDiscountSubtotal - amount) / preDiscountSubtotal) * 1000) / 10 : 0;
        return { outletRegion, amount, totalAmount: preDiscountSubtotal, discountPct };
      })
      .sort((a, b) => a.outletRegion.localeCompare(b.outletRegion));
    
    // Calculate actualRevenueTotal from totalOmsetPaid + danaTertahanTotal
    // This will be updated after we calculate those values
    let actualRevenueTotal = 0;

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

    // Total omset diterima (Order status PAID)
    const totalOmsetPaidData = await withRetry(async () => {
      const outletMap = new Map<string, number>();
      for (const order of orders) {
        if (normalizeOrderStatus(order.status) === "NOT PAID") {
          continue;
        }
        const { actualAmount } = computeActualAmount(order);
        if (actualAmount > 0) {
          const location = (order.location || "").trim();
          // Split Tokopedia by location so Jakarta & Bandung are shown separately in Dana Diterima
          const outletKey = order.outlet.toLowerCase() === "tokopedia" && location
            ? `${order.outlet} ${location}`
            : order.outlet;
          const current = outletMap.get(outletKey) || 0;
          outletMap.set(outletKey, current + actualAmount);
        }
      }
      
      const totalOmsetPaidByOutlet = Array.from(outletMap.entries())
        .map(([outlet, amount]) => ({ outlet, amount }))
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      
      const totalOmsetPaid = totalOmsetPaidByOutlet.reduce((sum, row) => sum + row.amount, 0);
      
      return { totalOmsetPaid, totalOmsetPaidByOutlet };
    }, 2, "finance-metrics-total-omset-paid");

    // Dana tertahan (Order status NOT PAID)
    const danaTertahanData = await withRetry(async () => {
      const outletMap = new Map<string, number>();
      const detailsMap = new Map<string, Array<{ customer: string; amount: number; location: string }>>();
      
      for (const order of orders) {
        if (normalizeOrderStatus(order.status) !== "NOT PAID") {
          continue;
        }
        const { actualAmount } = computeActualAmount(order);
        if (actualAmount > 0) {
          const current = outletMap.get(order.outlet) || 0;
          outletMap.set(order.outlet, current + actualAmount);

          const customerName = (order.customer && String(order.customer).trim()) || "-";
          const location = (order.location && String(order.location).trim()) || "-";
          const list = detailsMap.get(order.outlet) || [];
          list.push({ customer: customerName, amount: actualAmount, location });
          detailsMap.set(order.outlet, list);
        }
      }
      
      const danaTertahanByOutlet = Array.from(outletMap.entries())
        .map(([outlet, amount]) => ({ outlet, amount }))
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      
      const danaTertahanTotal = danaTertahanByOutlet.reduce((sum, row) => sum + row.amount, 0);
      const danaTertahanDetails = danaTertahanByOutlet.map((row) => ({
        outlet: row.outlet,
        entries: (detailsMap.get(row.outlet) || []).sort((a, b) => b.amount - a.amount),
      }));
      
      return { danaTertahan: danaTertahanByOutlet, danaTertahanTotal, danaTertahanDetails };
    }, 2, "finance-metrics-dana-tertahan");

    // Update actualRevenueTotal to be the sum of totalOmsetPaid + danaTertahanTotal
    actualRevenueTotal = totalOmsetPaidData.totalOmsetPaid + danaTertahanData.danaTertahanTotal;

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
    const pinjamModalGap = totalOmsetPaidData.totalOmsetPaid - totalPlanAmount;
    const pinjamModal = pinjamModalGap < 0 ? Math.abs(pinjamModalGap) : 0;

    const payload: MetricsResponse = {
      actualRevenueByOutlet,
      actualRevenueByOutletRegion,
      actualRevenueTotal,
      bahanBudget,
      totalOmsetPaid: totalOmsetPaidData.totalOmsetPaid,
      totalOmsetPaidByOutlet: totalOmsetPaidData.totalOmsetPaidByOutlet,
      danaTertahan: danaTertahanData.danaTertahan,
      danaTertahanTotal: danaTertahanData.danaTertahanTotal,
      danaTertahanDetails: danaTertahanData.danaTertahanDetails,
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
