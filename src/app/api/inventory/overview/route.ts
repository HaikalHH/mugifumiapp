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

    // Get reserved stock (orders that haven't been fully delivered)
    // Step 1: Get all order items from active orders
    const orderItems = await withRetry(async () => {
      return prisma.orderItem.findMany({
        where: {
          order: {
            status: {
              notIn: ['cancelled', 'completed']
            }
          }
        },
        select: {
          productId: true,
          quantity: true,
          order: {
            select: {
              id: true,
              location: true
            }
          }
        }
      });
    }, 2, 'inventory-overview-orderitems');

    // Step 2: Get all delivered items
    const deliveryItems = await withRetry(async () => {
      return prisma.deliveryItem.findMany({
        select: {
          productId: true,
          delivery: {
            select: {
              orderId: true,
              status: true,
              order: {
                select: {
                  location: true
                }
              }
            }
          }
        }
      });
    }, 2, 'inventory-overview-deliveryitems');

    // Create product map for efficient lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    const allProductKeys = products.map((p) => `${p.name} (${p.code})`);
    const knownLocations = new Set<string>(items.map((i) => i.location));
    // Ensure Bandung & Jakarta always present
    knownLocations.add("Bandung");
    knownLocations.add("Jakarta");

    // Initialize data structures
    const byLocation: Record<string, Record<string, StockInfo>> = {};
    for (const loc of Array.from(knownLocations)) {
      byLocation[loc] = {};
      for (const key of allProductKeys) {
        byLocation[loc][key] = { total: 0, reserved: 0, available: 0 };
      }
    }

    // Calculate total stock from inventory
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (product) {
        const loc = item.location;
        const key = `${product.name} (${product.code})`;
        byLocation[loc][key].total++;
      }
    }

    // Calculate reserved stock
    // First, count ordered quantities by product and location
    const orderedByProductLocation: Record<number, Record<string, number>> = {};
    for (const orderItem of orderItems) {
      const productId = orderItem.productId;
      const location = orderItem.order.location;
      
      if (!orderedByProductLocation[productId]) {
        orderedByProductLocation[productId] = {};
      }
      if (!orderedByProductLocation[productId][location]) {
        orderedByProductLocation[productId][location] = 0;
      }
      orderedByProductLocation[productId][location] += orderItem.quantity;
    }

    // Then, subtract delivered quantities
    for (const deliveryItem of deliveryItems) {
      const productId = deliveryItem.productId;
      const location = deliveryItem.delivery.order.location;
      
      if (orderedByProductLocation[productId] && orderedByProductLocation[productId][location]) {
        orderedByProductLocation[productId][location] -= 1;
      }
    }

    // Apply reserved stock to byLocation
    for (const [productIdStr, locationCounts] of Object.entries(orderedByProductLocation)) {
      const productId = parseInt(productIdStr);
      const product = productMap.get(productId);
      if (product) {
        const key = `${product.name} (${product.code})`;
        for (const [location, count] of Object.entries(locationCounts)) {
          if (byLocation[location] && byLocation[location][key]) {
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


