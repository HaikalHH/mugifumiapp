import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location") || undefined;
    const productCode = searchParams.get("productCode") || undefined;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    logRouteStart('inventory-list', { location, productCode, search, status, page, limit });

    // Build where clause for inventory
    const inventoryWhere = {
      location: location,
      barcode: search ? { contains: search } : undefined,
      status: status || undefined,
    };

    // If productCode filter is needed, we'll handle it after getting product IDs
    let productFilter: { id: { in: number[] } } | undefined;
    if (productCode) {
      const products = await withRetry(async () => {
        return prisma.product.findMany({
          where: { code: productCode },
          select: { id: true }
        });
      }, 2, 'inventory-list-products');
      
      if (products.length > 0) {
        productFilter = { id: { in: products.map(p => p.id) } };
      } else {
        // No products found with this code, return empty result
        return NextResponse.json({
          items: [],
          pagination: {
            page,
            limit,
            totalCount: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        });
      }
    }

    // Get inventory items with manual join
    const items = await withRetry(async () => {
      return prisma.inventory.findMany({
        where: {
          ...inventoryWhere,
          ...(productFilter && { productId: productFilter.id })
        },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          barcode: true,
          location: true,
          status: true,
          createdAt: true,
          productId: true,
        },
      });
    }, 2, 'inventory-list-items');

    // Get total count
    const totalCount = await withRetry(async () => {
      return prisma.inventory.count({
        where: {
          ...inventoryWhere,
          ...(productFilter && { productId: productFilter.id })
        }
      });
    }, 2, 'inventory-list-count');

    // Get product details for the items
    const productIds = [...new Set(items.map(item => item.productId))];
    const products = await withRetry(async () => {
      return prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { 
          id: true,
          code: true, 
          name: true, 
          price: true 
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'inventory-list-product-details');

    // Create product map for efficient lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    // Combine inventory items with product data
    const itemsWithProducts = items.map(item => {
      const product = productMap.get(item.productId);
      return {
        barcode: item.barcode,
        location: item.location,
        status: item.status,
        createdAt: item.createdAt,
        product: product ? {
          code: product.code,
          name: product.name,
          price: product.price
        } : null
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    logRouteComplete('inventory-list', items.length);
    return NextResponse.json({
      items: itemsWithProducts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("list inventory items", error), 
      { status: 500 }
    );
  }
}


