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

    // Build order filter
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

    // Get order items with manual joins for better performance
    const orderItems = await withRetry(async () => {
      return prisma.orderItem.findMany({
        where: {
          order: whereOrder,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          price: true,
          orderId: true,
        },
        orderBy: { id: 'desc' }
      });
    }, 2, 'reports-menu-items-order-items');

    if (orderItems.length === 0) {
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

    // Get unique product and order IDs
    const productIds = [...new Set(orderItems.map(item => item.productId))];
    const orderIds = [...new Set(orderItems.map(item => item.orderId))];

    // Get products and orders data separately
    const [products, orders] = await Promise.all([
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
        return prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            outlet: true,
            location: true,
            orderDate: true,
          },
          orderBy: { id: 'asc' }
        });
      }, 2, 'reports-menu-items-orders')
    ]);

    // Create lookup maps
    const productMap = new Map(products.map(p => [p.id, p]));
    const orderMap = new Map(orders.map(o => [o.id, o]));

    // Group by product and calculate totals
    const menuItemsMap = new Map();
    
    for (const item of orderItems) {
      const product = productMap.get(item.productId);
      const order = orderMap.get(item.orderId);
      
      if (!product || !order) continue; // Skip if data not found
      
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
      menuItem.totalQuantity += item.quantity; // Use quantity from order item
      menuItem.totalRevenue += (item.price * item.quantity); // price * quantity
      menuItem.totalHppValue += Math.round((item.price * item.quantity) * product.hppPct);
      menuItem.outlets.add(order.outlet);
      menuItem.locations.add(order.location);
      menuItem.sales.push({
        quantity: item.quantity,
        price: item.price,
        outlet: order.outlet,
        location: order.location,
        orderDate: order.orderDate,
        orderId: order.id,
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
