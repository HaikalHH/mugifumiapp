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
          actPayout: true,
          totalAmount: true,
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
      // Calculate total order value from items (pre-discount subtotal)
      const preDiscountSubtotal = order.items.reduce((sum: number, item: { price: number; quantity: number }) => sum + (item.price * item.quantity), 0);

      // Apply same logic as Reports Sales API
      const isFree = order.outlet.toLowerCase() === "free";
      const isCafe = order.outlet.toLowerCase() === "cafe";
      
      // Calculate ongkir difference for WhatsApp
      let ongkirDifference = 0;
      if (order.outlet.toLowerCase() === "whatsapp" && order.deliveries && order.deliveries.length > 0) {
        for (const delivery of order.deliveries) {
          if (delivery.ongkirPlan && delivery.ongkirActual && delivery.status === "delivered") {
            const diff = delivery.ongkirActual - delivery.ongkirPlan;
            if (diff > 0) {
              ongkirDifference += diff;
            }
          }
        }
      }
      
      // Use same actual calculation as Reports Sales API (with ongkir difference for WhatsApp)
      const actualAmount = isFree ? 0 : (isCafe ? (order.actPayout ?? 0) : 
        (order.outlet.toLowerCase() === "whatsapp" ? 
          ((order.actPayout || order.totalAmount || 0) - ongkirDifference) :
          (order.actPayout || order.totalAmount || 0)));
      
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

    // Total omset diterima (orders with actPayout set and status PAID, or status not set but has actPayout)
    const totalOmsetPaidData = await withRetry(async () => {
      const outletMap = new Map<string, number>();
      
      // Process all orders with actPayout (excluding NOT PAID status), or WhatsApp with processed delivery
      for (const order of orders) {
        const orderItems = (order.items || []) as Array<{ price: number; quantity: number }>;
        const preDiscountSubtotal = orderItems.reduce((acc: number, item: { price: number; quantity: number }) => acc + (item.price * item.quantity), 0);
        const totalAmount = order.totalAmount || preDiscountSubtotal;
        
        const isWhatsApp = order.outlet.toLowerCase() === "whatsapp";
        
        // Calculate ongkir difference for WhatsApp (only if processed delivery)
        let ongkirDifference = 0;
        let hasProcessedDelivery = false;
        if (isWhatsApp && order.deliveries && order.deliveries.length > 0) {
          hasProcessedDelivery = true;
          for (const delivery of order.deliveries) {
            if (delivery.ongkirPlan && delivery.ongkirActual && delivery.status === "delivered") {
              const diff = delivery.ongkirActual - delivery.ongkirPlan;
              if (diff > 0) {
                ongkirDifference += diff;
              }
            }
          }
        }
        
        // Include in Total Omset Diterima if:
        // 1. Has actPayout and status not NOT PAID, OR
        // 2. Any outlet with processed delivery (regardless of actPayout, but status not NOT PAID)
        const shouldInclude = 
          (order.actPayout !== null && order.actPayout !== undefined && order.status !== "NOT PAID") ||
          (hasProcessedDelivery && order.status !== "NOT PAID");
        
        if (shouldInclude) {
          // For WhatsApp with processed delivery, use totalAmount minus ongkir difference
          // For others, use actPayout
          const actualAmount = isWhatsApp && hasProcessedDelivery ? 
            (totalAmount - ongkirDifference) : 
            (order.actPayout || 0);
          
          if (actualAmount > 0) {
            const current = outletMap.get(order.outlet) || 0;
            outletMap.set(order.outlet, current + actualAmount);
          }
        }
      }
      
      const totalOmsetPaidByOutlet = Array.from(outletMap.entries())
        .map(([outlet, amount]) => ({ outlet, amount }))
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      
      const totalOmsetPaid = totalOmsetPaidByOutlet.reduce((sum, row) => sum + row.amount, 0);
      
      return { totalOmsetPaid, totalOmsetPaidByOutlet };
    }, 2, "finance-metrics-total-omset-paid");

    // Dana tertahan (orders without actPayout or with status NOT PAID)
    const danaTertahanData = await withRetry(async () => {
      const outletMap = new Map<string, number>();
      const detailsMap = new Map<string, Array<{ customer: string; amount: number; location: string }>>();
      
      // Process all orders to calculate dana tertahan
      for (const order of orders) {
        const orderItems = (order.items || []) as Array<{ price: number; quantity: number }>;
        const preDiscountSubtotal = orderItems.reduce((acc: number, item: { price: number; quantity: number }) => acc + (item.price * item.quantity), 0);
        const totalAmount = order.totalAmount || preDiscountSubtotal;
        
        const isWhatsApp = order.outlet.toLowerCase() === "whatsapp";
        const isFree = order.outlet.toLowerCase() === "free";
        
        // Skip Free outlet (always 0, doesn't go to dana tertahan)
        if (isFree) {
          continue;
        }
        
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
        
        let danaTertahanAmount = 0;
        
        // Calculate if has processed delivery for WhatsApp
        let hasProcessedDelivery = false;
        if (isWhatsApp && order.deliveries && order.deliveries.length > 0) {
          hasProcessedDelivery = true;
        }
        
        // Skip if already in Total Omset Diterima
        const isInTotalOmsetPaid = 
          (order.actPayout !== null && order.actPayout !== undefined && order.status !== "NOT PAID") ||
          (isWhatsApp && hasProcessedDelivery && order.status !== "NOT PAID");
        
        if (!isInTotalOmsetPaid) {
          // Case 1: Status NOT PAID -> use actPayout if available, otherwise totalAmount (minus ongkir difference for WhatsApp)
          if (order.status === "NOT PAID") {
            if (order.actPayout !== null && order.actPayout !== undefined) {
              danaTertahanAmount = order.actPayout;
            } else {
              danaTertahanAmount = isWhatsApp ? (totalAmount - ongkirDifference) : totalAmount;
            }
          }
          // Case 2: No actPayout (and status not NOT PAID) -> use totalAmount
          else if (order.actPayout === null || order.actPayout === undefined) {
            danaTertahanAmount = isWhatsApp ? (totalAmount - ongkirDifference) : totalAmount;
          }
        }
        
        if (danaTertahanAmount > 0) {
          const current = outletMap.get(order.outlet) || 0;
          outletMap.set(order.outlet, current + danaTertahanAmount);

          const customerName = (order.customer && String(order.customer).trim()) || "-";
          const location = (order.location && String(order.location).trim()) || "-";
          const list = detailsMap.get(order.outlet) || [];
          list.push({ customer: customerName, amount: danaTertahanAmount, location });
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
