import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location") || undefined;
    const productCode = searchParams.get("productCode") || undefined;

    const [items, products] = await Promise.all([
      prisma.inventory.findMany({
        where: {
          location: location,
          product: productCode ? { code: productCode } : undefined,
          status: "READY",
        },
        select: { location: true, product: { select: { id: true, code: true, name: true } } },
      }),
      prisma.product.findMany({ select: { code: true, name: true } }),
    ]);

    const allProductKeys = products.map((p) => `${p.name} (${p.code})`);
    const byLocation: Record<string, Record<string, number>> = {};
    const locations = new Set<string>(items.map((i) => i.location));
    locations.add("Bandung");
    locations.add("Jakarta");
    for (const loc of Array.from(locations)) {
      byLocation[loc] = {};
      for (const key of allProductKeys) byLocation[loc][key] = 0;
    }
    for (const it of items) {
      const loc = it.location;
      const key = `${it.product.name} (${it.product.code})`;
      byLocation[loc][key] = (byLocation[loc][key] || 0) + 1;
    }

    const all: Record<string, number> = {};
    for (const key of allProductKeys) all[key] = 0;
    for (const loc of Object.keys(byLocation)) {
      for (const k of Object.keys(byLocation[loc])) {
        all[k] = (all[k] || 0) + byLocation[loc][k];
      }
    }

    // Simple history: IN from Inventory.createdAt, OUT from SaleItem (createdAt not stored, use id ordering)
    // We will return lists of recent items for visibility purposes without heavy joins
    return NextResponse.json({ byLocation, all });
  } catch (e) {
    console.error("Inventory report error:", e);
    return NextResponse.json({ error: "Failed to build inventory report" }, { status: 500 });
  }
}


