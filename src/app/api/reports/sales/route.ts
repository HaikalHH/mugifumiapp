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

    const whereOrder: any = {};
    if (location) whereOrder.location = location;
    if (outlet) whereOrder.outlet = outlet;
    if (from || to) {
      whereOrder.orderDate = {};
      if (from) {
        // Frontend already sends Asia/Jakarta timezone converted to UTC
        whereOrder.orderDate.gte = new Date(from);
      }
      if (to) {
        // Frontend already sends Asia/Jakarta timezone converted to UTC
        whereOrder.orderDate.lte = new Date(to);
      }
    }

    // Use Order table instead of Sale table
    const orders = await withRetry(async () => {
      return prisma.order.findMany({
        where: whereOrder,
        select: {
          id: true,
          outlet: true,
          location: true,
          orderDate: true,
          discount: true,
          totalAmount: true,
          actPayout: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true
            }
          }
        },
        orderBy: { id: 'desc' }
      });
    }, 2, 'reports-sales-orders');

    if (orders.length === 0) {
      return NextResponse.json({ byOutlet: {}, byOutletRegion: {}, totalActual: 0, avgPotonganPct: null, sales: [] });
    }

    const needsDiscount = (ot: string) => {
      const k = ot.toLowerCase();
      return k === "whatsapp" || k === "cafe" || k === "wholesale";
    };

    const perSale = orders.map((order) => {
      const orderItems = order.items || [];
      const isCafe = order.outlet.toLowerCase() === "cafe";
      const isFree = order.outlet.toLowerCase() === "free";
      
      // Calculate subtotal from order items
      const preDiscountSubtotal = orderItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
      const discountPct = needsDiscount(order.outlet) && typeof order.discount === "number" ? order.discount : 0;
      const discountedSubtotal = Math.round(preDiscountSubtotal * (1 - (discountPct || 0) / 100));

      // For orders, use totalAmount as the expected total
      const expectedTotal = order.totalAmount || discountedSubtotal;

      // For orders, actual received is actPayout if available, otherwise totalAmount
      // For Free outlet, set to 0
      const actual = isFree ? 0 : (order.actPayout || order.totalAmount || null);

      // Potongan calculation for orders:
      // - Free: 100% (all is potongan since actual is 0)
      // - Cafe: original (pre-discount) minus actual (discounted)
      // - Others: difference between pre-discount and actual
      const potongan = isFree
        ? preDiscountSubtotal
        : (isCafe
          ? (preDiscountSubtotal - discountedSubtotal)
          : (actual != null ? (preDiscountSubtotal - actual) : null));

      const potonganPct = isFree
        ? 100
        : (isCafe
          ? (preDiscountSubtotal > 0 ? Math.round(((potongan as number / preDiscountSubtotal) * 100) * 10) / 10 : null)
          : (potongan != null && preDiscountSubtotal > 0 ? Math.round((potongan / preDiscountSubtotal) * 1000) / 10 : null));

      return {
        id: order.id,
        outlet: order.outlet,
        location: order.location,
        orderDate: order.orderDate,
        // Keep fields for consumers
        subtotal: preDiscountSubtotal,
        discountPct: discountPct || 0,
        total: expectedTotal,
        actualReceived: actual,
        potongan,
        potonganPct,
        originalBeforeDiscount: preDiscountSubtotal,
        itemsCount: orderItems.length,
      };
    });

    const byOutlet: Record<string, { count: number; actual: number; original: number; potongan: number }> = {};
    const byOutletRegionAgg: Record<string, { count: number; actual: number; original: number; potongan: number }> = {};
    let totalActual = 0;
    let totalOriginal = 0;
    let totalPotongan = 0;
    for (const row of perSale) {
      byOutlet[row.outlet] ||= { count: 0, actual: 0, original: 0, potongan: 0 };
      byOutlet[row.outlet].count += 1;
      byOutlet[row.outlet].actual += row.actualReceived || 0;
      byOutlet[row.outlet].original += row.originalBeforeDiscount || 0;
      byOutlet[row.outlet].potongan += row.potongan || 0;

      const regionKey = `${row.outlet} ${row.location}`.trim();
      byOutletRegionAgg[regionKey] ||= { count: 0, actual: 0, original: 0, potongan: 0 };
      byOutletRegionAgg[regionKey].count += 1;
      byOutletRegionAgg[regionKey].actual += row.actualReceived || 0;
      byOutletRegionAgg[regionKey].original += row.originalBeforeDiscount || 0;
      byOutletRegionAgg[regionKey].potongan += row.potongan || 0;
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

    const byOutletRegion = Object.fromEntries(
      Object.entries(byOutletRegionAgg).map(([k, v]) => [
        k,
        {
          count: v.count,
          actual: v.actual,
          potonganPct: v.original > 0 ? Math.round(((v.potongan / v.original) * 100) * 10) / 10 : null,
        },
      ])
    );
    
    logRouteComplete('reports-sales', perSale.length);
    return NextResponse.json({ byOutlet: out, byOutletRegion, totalActual, avgPotonganPct, sales: perSale });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("build sales report", error), 
      { status: 500 }
    );
  }
}


