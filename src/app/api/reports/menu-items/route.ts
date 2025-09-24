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

    logRouteStart('reports-menu-items', { from, to, location, outlet });

    // Build sale filter
    const whereSale: any = {};
    if (location) whereSale.location = location;
    if (outlet) whereSale.outlet = outlet;
    if (from || to) {
      whereSale.orderDate = {};
      if (from) {
        // Start from beginning of the day
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        whereSale.orderDate.gte = fromDate;
      }
      if (to) {
        // End at the end of the day (23:59:59.999)
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        whereSale.orderDate.lte = toDate;
      }
    }

    // Get sale items with manual joins for better performance
    const saleItems = await withRetry(async () => {
      return prisma.saleItem.findMany({
        where: {
          sale: whereSale,
        },
        select: {
          id: true,
          barcode: true,
          price: true,
          status: true,
          productId: true,
          saleId: true,
        },
        orderBy: { id: 'desc' }
      });
    }, 2, 'reports-menu-items-sale-items');

    if (saleItems.length === 0) {
      return NextResponse.json({
        menuItems: [],
        totals: {
          totalItems: 0,
          totalRevenue: 0,
          totalHppValue: 0,
          totalProfit: 0,
          uniqueProducts: 0,
        },
      });
    }

    // Get unique product and sale IDs
    const productIds = [...new Set(saleItems.map(item => item.productId))];
    const saleIds = [...new Set(saleItems.map(item => item.saleId))];

    // Get products and sales data separately
    const [products, sales] = await Promise.all([
      withRetry(async () => {
        return prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            hppPct: true,
          },
          orderBy: { id: 'asc' }
        });
      }, 2, 'reports-menu-items-products'),
      withRetry(async () => {
        return prisma.sale.findMany({
          where: { id: { in: saleIds } },
          select: {
            id: true,
            outlet: true,
            location: true,
            orderDate: true,
          },
          orderBy: { id: 'asc' }
        });
      }, 2, 'reports-menu-items-sales')
    ]);

    // Create lookup maps
    const productMap = new Map(products.map(p => [p.id, p]));
    const saleMap = new Map(sales.map(s => [s.id, s]));

    // Group by product and calculate totals
    const menuItemsMap = new Map();
    
    for (const item of saleItems) {
      const product = productMap.get(item.productId);
      const sale = saleMap.get(item.saleId);
      
      if (!product || !sale) continue; // Skip if data not found
      
      const productKey = `${product.code} - ${product.name}`;
      
      if (!menuItemsMap.has(productKey)) {
        menuItemsMap.set(productKey, {
          productCode: product.code,
          productName: product.name,
          productPrice: product.price,
          hppPct: product.hppPct,
          totalQuantity: 0,
          totalRevenue: 0,
          totalHppValue: 0,
          outlets: new Set(),
          locations: new Set(),
          sales: [],
        });
      }
      
      const menuItem = menuItemsMap.get(productKey);
      menuItem.totalQuantity += 1;
      menuItem.totalRevenue += item.price;
      menuItem.totalHppValue += Math.round(item.price * product.hppPct);
      menuItem.outlets.add(sale.outlet);
      menuItem.locations.add(sale.location);
      menuItem.sales.push({
        barcode: item.barcode,
        price: item.price,
        outlet: sale.outlet,
        location: sale.location,
        orderDate: sale.orderDate,
        status: item.status,
      });
    }

    // Convert to array and sort by total quantity
    const menuItems = Array.from(menuItemsMap.values()).map(item => ({
      ...item,
      outlets: Array.from(item.outlets),
      locations: Array.from(item.locations),
      averagePrice: item.totalQuantity > 0 ? Math.round(item.totalRevenue / item.totalQuantity) : 0,
      totalProfit: item.totalRevenue - item.totalHppValue,
    })).sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Calculate totals
    const totals = {
      totalItems: menuItems.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalRevenue: menuItems.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalHppValue: menuItems.reduce((sum, item) => sum + item.totalHppValue, 0),
      totalProfit: menuItems.reduce((sum, item) => sum + item.totalProfit, 0),
      uniqueProducts: menuItems.length,
    };

    logRouteComplete('reports-menu-items', menuItems.length);
    return NextResponse.json({
      menuItems,
      totals,
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("build menu items report", error), 
      { status: 500 }
    );
  }
}
