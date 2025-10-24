import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

interface StockInfo {
  total: number;
  reserved: number;
  available: number;
}

export async function GET() {
  try {
    logRouteStart('inventory-overview');

    // Get ALL products first (not just those with inventory)
    const products = await withRetry(async () => {
      return prisma.product.findMany({ 
        select: { 
          id: true,
          code: true, 
          name: true 
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'inventory-overview-products');

    // Then get inventory items for counting (total stock)
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

    // Fetch order items for orders that should contribute to reserved stock
    const orders = await withRetry(async () => {
      return prisma.order.findMany({
        where: {
          deliveries: {
            none: {}
          },
        },
        select: {
          id: true,
          location: true,
          items: {
            select: {
              productId: true,
              quantity: true,
            }
          }
        }
      });
    }, 2, 'inventory-overview-openorders');

    // Create product map for efficient lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    const allProductKeys = products.map((p) => `${p.name} (${p.code})`);
    const knownLocations = new Set<string>(items.map((i) => i.location));
    for (const order of orders) {
      knownLocations.add(order.location);
    }
    // Ensure Bandung & Jakarta always present
    knownLocations.add("Bandung");
    knownLocations.add("Jakarta");

    // Initialize data structures
    const byLocation: Record<string, Record<string, StockInfo>> = {};
    const ensureLocation = (loc: string) => {
      if (!byLocation[loc]) {
        byLocation[loc] = {};
        for (const key of allProductKeys) {
          byLocation[loc][key] = { total: 0, reserved: 0, available: 0 };
        }
      }
    };
    for (const loc of Array.from(knownLocations)) {
      ensureLocation(loc);
    }

    // Calculate total stock from inventory
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (product) {
        const loc = item.location;
        const key = `${product.name} (${product.code})`;
        ensureLocation(loc);
        byLocation[loc][key].total++;
      }
    }

    // Calculate reserved stock from remaining ordered quantities (after subtracting delivered items)
    const orderedByProductLocation: Record<number, Record<string, number>> = {};
    for (const order of orders) {
      const location = order.location;
      for (const item of order.items) {
        if (!orderedByProductLocation[item.productId]) {
          orderedByProductLocation[item.productId] = {};
        }
        if (!orderedByProductLocation[item.productId][location]) {
          orderedByProductLocation[item.productId][location] = 0;
        }
        orderedByProductLocation[item.productId][location] += item.quantity;
      }
    }

    // Apply reserved stock to byLocation
    for (const [productIdStr, locationCounts] of Object.entries(orderedByProductLocation)) {
      const productId = parseInt(productIdStr);
      const product = productMap.get(productId);
      if (product) {
        const key = `${product.name} (${product.code})`;
        for (const [location, count] of Object.entries(locationCounts)) {
          ensureLocation(location);
          if (byLocation[location][key]) {
            byLocation[location][key].reserved = Math.max(0, count);
          }
        }
      }
    }

    // Calculate available stock (total - reserved)
    // Allow negative values to show over-order situations
    for (const loc of Object.keys(byLocation)) {
      for (const key of Object.keys(byLocation[loc])) {
        byLocation[loc][key].available = byLocation[loc][key].total - byLocation[loc][key].reserved;
      }
    }

    // Calculate totals across all locations
    const all: Record<string, StockInfo> = {};
    for (const key of allProductKeys) {
      all[key] = { total: 0, reserved: 0, available: 0 };
    }
    for (const loc of Object.keys(byLocation)) {
      for (const k of Object.keys(byLocation[loc])) {
        all[k].total += byLocation[loc][k].total;
        all[k].reserved += byLocation[loc][k].reserved;
        all[k].available += byLocation[loc][k].available;
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
