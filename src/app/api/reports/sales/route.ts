import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const location = searchParams.get("location") || undefined;
    const outlet = searchParams.get("outlet") || undefined;

    const whereSale: any = {};
    if (location) whereSale.location = location;
    if (outlet) whereSale.outlet = outlet;
    if (from || to) {
      whereSale.orderDate = {};
      if (from) whereSale.orderDate.gte = new Date(from);
      if (to) whereSale.orderDate.lte = new Date(to);
    }

    const sales = await prisma.sale.findMany({
      where: whereSale,
      include: { items: true },
      orderBy: { orderDate: "desc" },
    });

    const needsDiscount = (ot: string) => {
      const k = ot.toLowerCase();
      return k === "whatsapp" || k === "cafe" || k === "wholesale";
    };

    const perSale = sales.map((s) => {
      const isCafe = s.outlet.toLowerCase() === "cafe";
      // For Cafe, only count items with status 'Terjual' toward calculations
      const effectiveItems = isCafe ? s.items.filter((it) => (it.status || "").toLowerCase() === "terjual") : s.items;
      const preDiscountSubtotal = effectiveItems.reduce((acc, it) => acc + it.price, 0);
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
        itemsCount: s.items.length,
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
    return NextResponse.json({ byOutlet: out, totalActual, avgPotonganPct, sales: perSale });
  } catch (e) {
    return NextResponse.json({ error: "Failed to build sales report" }, { status: 500 });
  }
}


