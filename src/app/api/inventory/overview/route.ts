import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET() {
  try {
    logRouteStart('inventory-overview');

    // Use sequential queries instead of Promise.all for better reliability
    const items = await withRetry(async () => {
      return prisma.inventory.findMany({
        where: { status: "READY" },
        select: { 
          id: true,
          location: true, 
          productId: true 
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'inventory-overview-items');

    const productIds = [...new Set(items.map(item => item.productId))];
    
    const products = await withRetry(async () => {
      return prisma.product.findMany({ 
        where: { id: { in: productIds } },
        select: { 
          id: true,
          code: true, 
          name: true 
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'inventory-overview-products');

    // Create product map for efficient lookup
    const productMap = new Map(products.map(p => [p.id, p]));

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

    // Process items with manual join
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (product) {
        const loc = item.location;
        const key = `${product.name} (${product.code})`;
        byLocation[loc][key] = (byLocation[loc][key] || 0) + 1;
      }
    }

    const all: Record<string, number> = {};
    for (const key of allProductKeys) all[key] = 0;
    for (const loc of Object.keys(byLocation)) {
      for (const k of Object.keys(byLocation[loc])) {
        all[k] = (all[k] || 0) + byLocation[loc][k];
      }
    }

    logRouteComplete('inventory-overview', items.length);
    return NextResponse.json({ byLocation, all });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("get inventory overview", error), 
      { status: 500 }
    );
  }
}


