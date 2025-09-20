import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    const [items, products] = await Promise.all([
      prisma.inventory.findMany({
      where: { status: "READY" },
        select: { location: true, product: { select: { name: true, code: true } } },
      }),
      prisma.product.findMany({ select: { code: true, name: true } }),
    ]);

    const allProductKeys = products.map((p) => `${p.name} (${p.code})`);
    const knownLocations = new Set<string>(items.map((i) => i.location));
    // Ensure Bandung & Jakarta always present
    knownLocations.add("Bandung");
    knownLocations.add("Jakarta");

    const byLocation: Record<string, Record<string, number>> = {};
    for (const loc of Array.from(knownLocations)) {
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
    for (const loc of Object.keys(byLocation)) for (const k of Object.keys(byLocation[loc])) all[k] = (all[k] || 0) + byLocation[loc][k];

    return NextResponse.json({ byLocation, all });
  } catch {
    return NextResponse.json({ error: "Failed to get overview" }, { status: 500 });
  }
}


