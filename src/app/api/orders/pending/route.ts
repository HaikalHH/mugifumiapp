import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    logRouteStart('orders-pending');

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const location = searchParams.get("location") || undefined;
    const search = searchParams.get("search") || undefined;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {
      deliveries: {
        none: {}
      }
    };

    if (location && location !== "all") {
      where.location = location;
    }

    if (search) {
      where.OR = [
        { customer: { contains: search } },
        { outlet: { contains: search } }
      ];
    }

    const [orders, total] = await Promise.all([
      withRetry(async () => {
        return prisma.order.findMany({
          where,
          select: {
            id: true,
            outlet: true,
            customer: true,
            orderDate: true,
            deliveryDate: true,
            location: true,
            status: true,
            totalAmount: true,
            actPayout: true,
            ongkirPlan: true,
            items: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                price: true,
                product: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    price: true
                  }
                }
              }
            }
          },
          orderBy: [
            { deliveryDate: { sort: 'asc', nulls: 'last' } },
            { orderDate: 'asc' },
            { id: 'asc' }
          ],
          skip,
          take: pageSize
        });
      }, 2, 'orders-pending'),
      withRetry(async () => {
        return prisma.order.count({ where });
      }, 2, 'orders-pending-count')
    ]);

    logRouteComplete('orders-pending', orders.length);
    return NextResponse.json({
      rows: orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch pending orders", error), 
      { status: 500 }
    );
  }
}
