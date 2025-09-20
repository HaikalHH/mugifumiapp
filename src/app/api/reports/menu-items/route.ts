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

    // Get all sale items with product information
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: whereSale,
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            hppPct: true,
          },
        },
        sale: {
          select: {
            outlet: true,
            location: true,
            orderDate: true,
          },
        },
      },
      orderBy: {
        sale: {
          orderDate: "desc",
        },
      },
    });

    // Group by product and calculate totals
    const menuItemsMap = new Map();
    
    for (const item of saleItems) {
      const productKey = `${item.product.code} - ${item.product.name}`;
      
      if (!menuItemsMap.has(productKey)) {
        menuItemsMap.set(productKey, {
          productCode: item.product.code,
          productName: item.product.name,
          productPrice: item.product.price,
          hppPct: item.product.hppPct,
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
      menuItem.totalHppValue += Math.round(item.price * item.product.hppPct);
      menuItem.outlets.add(item.sale.outlet);
      menuItem.locations.add(item.sale.location);
      menuItem.sales.push({
        barcode: item.barcode,
        price: item.price,
        outlet: item.sale.outlet,
        location: item.sale.location,
        orderDate: item.sale.orderDate,
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

    return NextResponse.json({
      menuItems,
      totals,
    });
  } catch (e) {
    console.error("Menu items report error:", e);
    return NextResponse.json({ error: "Failed to build menu items report" }, { status: 500 });
  }
}
