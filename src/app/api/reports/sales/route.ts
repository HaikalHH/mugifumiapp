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
          customer: true,
          location: true,
          orderDate: true,
          discount: true,
          totalAmount: true,
          actPayout: true,
          ongkirPlan: true,
          midtransFee: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true
            }
          },
          deliveries: {
            select: {
              ongkirPlan: true,
              ongkirActual: true,
              status: true
            }
          }
        },
        orderBy: { id: 'desc' }
      });
    }, 2, 'reports-sales-orders');

    const needsDiscount = (ot: string) => {
      const k = ot.toLowerCase();
      return k === "whatsapp" || k === "cafe" || k === "wholesale";
    };

    const perSale = orders.map((order) => {
      const orderItems = order.items || [];
      const isCafe = order.outlet.toLowerCase() === "cafe";
      const isFree = order.outlet.toLowerCase() === "free";
      const isWhatsApp = order.outlet.toLowerCase() === "whatsapp";
      const isB2BOutlet = order.outlet.toLowerCase() === "cafe" || order.outlet.toLowerCase() === "wholesale";
      
      // Calculate subtotal from order items
      const preDiscountSubtotal = orderItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
      const discountPct = needsDiscount(order.outlet) && typeof order.discount === "number" ? order.discount : 0;
      const discountedSubtotal = Math.round(preDiscountSubtotal * (1 - (discountPct || 0) / 100));

      // For orders, use totalAmount as the expected total
      const expectedTotal = order.totalAmount || discountedSubtotal;

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

      // Determine base actual before ongkir adjustment
      const resolvedActual = order.actPayout != null
        ? order.actPayout
        : (order.totalAmount != null ? order.totalAmount : null);
      const recordedMidtransFee = order.midtransFee ?? 0;
      const planOngkirValue = order.ongkirPlan || 0;

      // For orders, actual received is actPayout if available, otherwise totalAmount
      // For Free outlet, set to 0
      // For Cafe outlet, actual = actPayout (or 0 if empty)
      // For WhatsApp, gunakan nilai barang (setelah diskon) dan hanya kurangi selisih ongkir yang lebih besar
      let actual: number | null;
      if (isFree) {
        actual = 0;
      } else if (isCafe) {
        actual = order.actPayout ?? 0;
      } else if (isWhatsApp) {
        const extraOngkir = Math.max(0, ongkirDifference);
        actual = Math.max(0, discountedSubtotal - extraOngkir);
      } else {
        actual = resolvedActual;
      }

      // Potongan calculation for orders:
      // - Free: 100% (all is potongan since actual is 0)
      // - Cafe: original (pre-discount) minus actual
      //   If actPayout is set, use it; otherwise actual is 0, so potongan = preDiscountSubtotal
      // - Others: difference between pre-discount and actual
      const potongan = isFree
        ? preDiscountSubtotal
        : (isCafe
          ? (preDiscountSubtotal - (actual ?? 0))
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
        customer: order.customer || null,
        // Keep fields for consumers
        subtotal: preDiscountSubtotal,
        discountPct: discountPct || 0,
        total: expectedTotal,
        actualReceived: actual,
        potongan,
        potonganPct,
        originalBeforeDiscount: preDiscountSubtotal,
        itemsCount: orderItems.length,
        source: isB2BOutlet ? "B2B" : "Retail",
        midtransFee: isWhatsApp ? recordedMidtransFee : 0,
      };
    });

    // B2B orders (Wholesale/Cafe) - pulled into same report
    const whereB2B: any = {};
    if (location) whereB2B.location = location;
    if (outlet) whereB2B.outlet = outlet;
    if (from || to) {
      whereB2B.orderDate = {};
      if (from) whereB2B.orderDate.gte = new Date(from);
      if (to) whereB2B.orderDate.lte = new Date(to);
    }

    const b2bOrders = await withRetry(async () => {
      return prisma.orderB2B.findMany({
        where: whereB2B,
        select: {
          id: true,
          outlet: true,
          customer: true,
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
              price: true,
            },
          },
        },
        orderBy: { id: "desc" },
      });
    }, 2, "reports-sales-b2b");

    const perSaleB2B = b2bOrders.map((order) => {
      const orderItems = order.items || [];
      const preDiscountSubtotal = orderItems.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
      const discountPct = typeof order.discount === "number" ? order.discount : 0;
      const discountedSubtotal = discountPct ? Math.round(preDiscountSubtotal * (1 - discountPct / 100)) : preDiscountSubtotal;
      const resolvedActual = order.actPayout != null ? order.actPayout : order.totalAmount ?? discountedSubtotal;
      const actual = resolvedActual ?? 0;
      const potongan = preDiscountSubtotal - (actual ?? 0);
      const potonganPct = preDiscountSubtotal > 0 ? Math.round((potongan / preDiscountSubtotal) * 1000) / 10 : null;
      return {
        id: order.id,
        outlet: order.outlet,
        customer: order.customer || null,
        location: order.location,
        orderDate: order.orderDate,
        subtotal: preDiscountSubtotal,
        discountPct: discountPct || 0,
        total: order.totalAmount ?? discountedSubtotal,
        actualReceived: actual,
        potongan,
        potonganPct,
        originalBeforeDiscount: preDiscountSubtotal,
        itemsCount: orderItems.length,
        source: "B2B",
        midtransFee: 0,
      };
    });

    const combined = [...perSale, ...perSaleB2B];

    const byOutlet: Record<string, { count: number; actual: number; original: number; potongan: number; midtransFee: number }> = {};
    const byOutletRegionAgg: Record<string, { count: number; actual: number; original: number; potongan: number; midtransFee: number }> = {};
    let totalActual = 0;
    let totalOriginal = 0;
    let totalPotongan = 0;
    for (const row of combined) {
      const fee = row.midtransFee || 0;
      byOutlet[row.outlet] ||= { count: 0, actual: 0, original: 0, potongan: 0, midtransFee: 0 };
      byOutlet[row.outlet].count += 1;
      byOutlet[row.outlet].actual += row.actualReceived || 0;
      byOutlet[row.outlet].original += row.originalBeforeDiscount || 0;
      byOutlet[row.outlet].potongan += row.potongan || 0;
      byOutlet[row.outlet].midtransFee += fee;

      const regionKey = `${row.outlet} ${row.location}`.trim();
      byOutletRegionAgg[regionKey] ||= { count: 0, actual: 0, original: 0, potongan: 0, midtransFee: 0 };
      byOutletRegionAgg[regionKey].count += 1;
      byOutletRegionAgg[regionKey].actual += row.actualReceived || 0;
      byOutletRegionAgg[regionKey].original += row.originalBeforeDiscount || 0;
      byOutletRegionAgg[regionKey].potongan += row.potongan || 0;
      byOutletRegionAgg[regionKey].midtransFee += fee;
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
          midtransFee: v.midtransFee,
          midtransFeePct:
            v.actual + v.midtransFee > 0 ? Math.round(((v.midtransFee / (v.actual + v.midtransFee)) * 100) * 10) / 10 : null,
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
    
    logRouteComplete('reports-sales', combined.length);
    return NextResponse.json({ byOutlet: out, byOutletRegion, totalActual, avgPotonganPct, sales: combined });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("build sales report", error), 
      { status: 500 }
    );
  }
}
