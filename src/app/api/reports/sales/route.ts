import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const location = searchParams.get("location") || undefined;
    const outlet = searchParams.get("outlet") || undefined;

    logRouteStart('reports-sales', { from, to, location, outlet });

    const whereSale: any = {};
    if (location) whereSale.location = location;
    if (outlet) whereSale.outlet = outlet;
    if (from || to) {
      whereSale.orderDate = {};
      if (from) {
        // Start from beginning of the day
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        whereSale.orderDate.gte = fromDate;
      }
      if (to) {
        // End at the end of the day (23:59:59.999)
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        whereSale.orderDate.lte = toDate;
      }
    }

    // Use manual joins for better performance
    const sales = await withRetry(async () => {
      return prisma.sale.findMany({
        where: whereSale,
        select: {
          id: true,
          outlet: true,
          location: true,
          orderDate: true,
          discount: true,
          estPayout: true,
          actPayout: true
        },
        orderBy: { id: 'desc' }
      });
    }, 2, 'reports-sales-sales');

    if (sales.length === 0) {
      return NextResponse.json({ byOutlet: {}, totalActual: 0, avgPotonganPct: null, sales: [] });
    }

    // Get sale items separately
    const saleIds = sales.map(s => s.id);
    const items = await withRetry(async () => {
      return prisma.saleItem.findMany({
        where: { saleId: { in: saleIds } },
        select: {
          id: true,
          saleId: true,
          price: true,
          status: true
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'reports-sales-items');

    // Group items by saleId
    const itemsBySale = new Map();
    for (const item of items) {
      if (!itemsBySale.has(item.saleId)) {
        itemsBySale.set(item.saleId, []);
      }
      itemsBySale.get(item.saleId).push(item);
    }

    const needsDiscount = (ot: string) => {
      const k = ot.toLowerCase();
      return k === "whatsapp" || k === "cafe" || k === "wholesale";
    };

    const perSale = sales.map((s) => {
      const saleItems = itemsBySale.get(s.id) || [];
      const isCafe = s.outlet.toLowerCase() === "cafe";
      // For Cafe, only count items with status 'Terjual' toward calculations
      const effectiveItems = isCafe ? saleItems.filter((it: any) => (it.status || "").toLowerCase() === "terjual") : saleItems;
      const preDiscountSubtotal = effectiveItems.reduce((acc: number, it: any) => acc + it.price, 0);
      const discountPct = needsDiscount(s.outlet) && typeof s.discount === "number" ? s.discount : 0;
      const discountedSubtotal = Math.round(preDiscountSubtotal * (1 - (discountPct || 0) / 100));

      // Expected total still respects estimate if available (for non-cafe)
      const expectedTotal = isCafe ? discountedSubtotal : (s.estPayout ?? discountedSubtotal);

      // For Cafe, actual equals discounted subtotal of SOLD items only; others use recorded actual payout
      const actual = isCafe ? discountedSubtotal : (s.actPayout ?? null);

      // Potongan definition:
      // - Cafe: original (pre-discount, sold items only) minus actual (discounted)
      // - Others: maintain previous behavior (difference between expected and actual)
      const potongan = isCafe
        ? (preDiscountSubtotal - discountedSubtotal)
        : (actual != null ? (expectedTotal - actual) : null);

      const potonganPct = isCafe
        ? (preDiscountSubtotal > 0 ? Math.round(((potongan as number / preDiscountSubtotal) * 100) * 10) / 10 : null)
        : (potongan != null && expectedTotal > 0 ? Math.round((potongan / expectedTotal) * 1000) / 10 : null);

      return {
        id: s.id,
        outlet: s.outlet,
        location: s.location,
        orderDate: s.orderDate,
        // Keep fields for consumers
        subtotal: preDiscountSubtotal,
        discountPct: discountPct || 0,
        total: expectedTotal,
        actualReceived: actual,
        potongan,
        potonganPct,
        originalBeforeDiscount: preDiscountSubtotal,
        itemsCount: saleItems.length,
      };
    });

    const byOutlet: Record<string, { count: number; actual: number; original: number; potongan: number }> = {};
    let totalActual = 0;
    let totalOriginal = 0;
    let totalPotongan = 0;
    for (const row of perSale) {
      byOutlet[row.outlet] ||= { count: 0, actual: 0, original: 0, potongan: 0 };
      byOutlet[row.outlet].count += 1;
      byOutlet[row.outlet].actual += row.actualReceived || 0;
      byOutlet[row.outlet].original += row.originalBeforeDiscount || 0;
      byOutlet[row.outlet].potongan += row.potongan || 0;
      totalActual += row.actualReceived || 0;
      totalOriginal += row.originalBeforeDiscount || 0;
      totalPotongan += row.potongan || 0;
    }
    const out = Object.fromEntries(
      Object.entries(byOutlet).map(([k, v]) => [
        k,
        {
          count: v.count,
          actual: v.actual,
          potonganPct: v.original > 0 ? Math.round(((v.potongan / v.original) * 100) * 10) / 10 : null,
        },
      ])
    );
    const avgPotonganPct = totalOriginal > 0 ? Math.round(((totalPotongan / totalOriginal) * 100) * 10) / 10 : null;
    
    logRouteComplete('reports-sales', perSale.length);
    return NextResponse.json({ byOutlet: out, totalActual, avgPotonganPct, sales: perSale });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("build sales report", error), 
      { status: 500 }
    );
  }
}


