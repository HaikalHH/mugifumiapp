import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location") || undefined;
    const productCode = searchParams.get("productCode") || undefined;

    logRouteStart('reports-inventory', { location, productCode });

    // Handle productCode filter first if provided
    let productFilter: { id: { in: number[] } } | undefined;
    if (productCode) {
      const products = await withRetry(async () => {
        return prisma.product.findMany({
          where: { code: productCode },
          select: { id: true }
        });
      }, 2, 'reports-inventory-products');
      
      if (products.length > 0) {
        productFilter = { id: { in: products.map(p => p.id) } };
      } else {
        // No products found with this code, return empty result
        return NextResponse.json({ byLocation: {}, all: {} });
      }
    }

    // Get inventory items with manual join
    const items = await withRetry(async () => {
      return prisma.inventory.findMany({
        where: {
          location: location,
          ...(productFilter && { productId: productFilter.id }),
          status: "READY",
        },
        select: { 
          id: true,
          location: true, 
          productId: true 
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'reports-inventory-items');

    // Get all products (or filtered products)
    const products = await withRetry(async () => {
      return prisma.product.findMany({ 
        where: productFilter || {},
        select: { 
          id: true,
          code: true, 
          name: true 
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'reports-inventory-all-products');

    // Create product map for efficient lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    const allProductKeys = products.map((p) => `${p.name} (${p.code})`);
    const byLocation: Record<string, Record<string, number>> = {};
    const locations = new Set<string>(items.map((i) => i.location));
    locations.add("Bandung");
    locations.add("Jakarta");
    
    for (const loc of Array.from(locations)) {
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

    logRouteComplete('reports-inventory', items.length);
    return NextResponse.json({ byLocation, all });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("build inventory report", error), 
      { status: 500 }
    );
  }
}


