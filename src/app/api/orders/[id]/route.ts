import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    logRouteStart('order-update');

    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await req.json();
    const {
      outlet,
      customer,
      status,
      orderDate,
      location,
      discount,
      actPayout,
      items, // Array of { productId, quantity }
    } = body as {
      outlet: string;
      customer?: string;
      status?: string;
      orderDate?: string;
      location: string;
      discount?: number | null;
      actPayout?: number | null;
      items?: Array<{ productId: number; quantity: number }>;
    };

    if (!outlet || !location) {
      return NextResponse.json({ error: "outlet and location are required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "at least one item is required" }, { status: 400 });
    }

    // Check if order exists
    const existingOrder = await withRetry(async () => {
      return prisma.order.findUnique({
        where: { id: orderId },
        include: {
          deliveries: true
        }
      });
    }, 2, 'order-update-find');

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if order has deliveries (cannot edit if already delivered)
    if (existingOrder.deliveries.length > 0) {
      return NextResponse.json({ error: "Cannot edit order that has been delivered" }, { status: 400 });
    }

    // Get product prices
    const productIds = items.map(item => item.productId);
    const products = await withRetry(async () => {
      return prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, price: true }
      });
    }, 2, 'order-update-products');

    const productMap = new Map(products.map(p => [p.id, p.price]));
    
    // Calculate total
    const subtotal = items.reduce((sum, item) => {
      const price = productMap.get(item.productId) || 0;
      return sum + (price * item.quantity);
    }, 0);

    const totalAmount = discount 
      ? Math.round(subtotal * (1 - discount / 100))
      : subtotal;

    // Use transaction to update order and items
    const updatedOrder = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // Delete existing order items
        await tx.orderItem.deleteMany({
          where: { orderId: orderId }
        });

        // Update order
        const order = await tx.order.update({
          where: { id: orderId },
          data: {
            outlet,
            customer: customer || null,
            status: status || "confirmed",
            orderDate: orderDate ? new Date(orderDate) : new Date(),
            location,
            discount: typeof discount === "number" && Number.isFinite(discount) ? discount : null,
            totalAmount: totalAmount,
            actPayout: actPayout || null,
          },
          select: {
            id: true,
            outlet: true,
            customer: true,
            status: true,
            orderDate: true,
            location: true,
            discount: true,
            totalAmount: true,
            actPayout: true,
            createdAt: true,
            deliveries: {
              select: {
                id: true,
                status: true
              }
            },
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
          }
        });

        // Create new order items
        for (const item of items) {
          const price = productMap.get(item.productId) || 0;
          await tx.orderItem.create({
            data: {
              orderId: orderId,
              productId: item.productId,
              quantity: item.quantity,
              price: price
            }
          });
        }

        return order;
      });
    }, 2, 'order-update-transaction');

    logRouteComplete('order-update');
    return NextResponse.json(updatedOrder);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("update order", error), 
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    logRouteStart('order-delete');

    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // Check if order exists
    const order = await withRetry(async () => {
      return prisma.order.findUnique({
        where: { id: orderId },
        include: {
          deliveries: true
        }
      });
    }, 2, 'order-delete-find');

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if order has deliveries (cannot delete if already delivered)
    if (order.deliveries.length > 0) {
      return NextResponse.json({ error: "Cannot delete order that has been delivered" }, { status: 400 });
    }

    // Use transaction to delete order and related items
    await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // Delete order items first
        await tx.orderItem.deleteMany({
          where: { orderId: orderId }
        });

        // Delete order
        await tx.order.delete({
          where: { id: orderId }
        });
      });
    }, 2, 'order-delete-transaction');

    logRouteComplete('order-delete');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("delete order", error), 
      { status: 500 }
    );
  }
}
