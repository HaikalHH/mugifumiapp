import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { createSnapTransaction } from "../../../../lib/midtrans";

const MIDTRANS_EXPIRY_MINUTES = Number(process.env.MIDTRANS_EXPIRY_MINUTES || 60);

const ORDER_SELECT = {
  id: true,
  outlet: true,
  customer: true,
  status: true,
  orderDate: true,
  deliveryDate: true,
  location: true,
  discount: true,
  totalAmount: true,
  actPayout: true,
  ongkirPlan: true,
  paymentLink: true,
  midtransOrderId: true,
  midtransTransactionId: true,
  createdAt: true,
  deliveries: {
    select: {
      id: true,
      status: true,
    },
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
          price: true,
        },
      },
    },
  },
} as const;

function normalizeOrderStatus(rawStatus?: string | null): "PAID" | "NOT PAID" {
  if (!rawStatus) return "PAID";
  const normalized = rawStatus.trim().toUpperCase().replace(/\s+/g, " ");
  if (normalized === "NOT PAID" || normalized === "NOT_PAID") {
    return "NOT PAID";
  }
  return "PAID";
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('order-update');

    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await req.json();
    const {
      outlet,
      customer,
      status,
      orderDate,
      deliveryDate,
      location,
      discount,
      actPayout,
      ongkirPlan,
      items, // Array of { productId, quantity }
    } = body as {
      outlet: string;
      customer?: string;
      status?: string;
      orderDate?: string;
      deliveryDate?: string;
      location: string;
      discount?: number | null;
      actPayout?: number | null;
      ongkirPlan?: number | null;
      items?: Array<{ productId: number; quantity: number }>;
    };

    if (!outlet || !location) {
      return NextResponse.json({ error: "outlet and location are required" }, { status: 400 });
    }

    // Check if order exists
    const existingOrder = await withRetry(async () => {
      return prisma.order.findUnique({
        where: { id: orderId },
        include: {
          deliveries: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              price: true,
            },
          },
        },
      });
    }, 2, "order-update-find");

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isDelivered = existingOrder.deliveries.length > 0;
    const isWhatsAppOutlet = outlet.toLowerCase() === "whatsapp";
    if (!orderDate) {
      return NextResponse.json({ error: "orderDate is required" }, { status: 400 });
    }
    if (!deliveryDate) {
      return NextResponse.json({ error: "deliveryDate is required" }, { status: 400 });
    }
    if (isWhatsAppOutlet) {
      if (ongkirPlan === undefined || ongkirPlan === null || Number(ongkirPlan) <= 0) {
        return NextResponse.json({ error: "ongkirPlan is required for WhatsApp orders" }, { status: 400 });
      }
    }

    // If not delivered, we still require at least one item in payload
    if (!isDelivered && (!items || items.length === 0)) {
      return NextResponse.json({ error: "at least one item is required" }, { status: 400 });
    }

    // Build item set and subtotal source
    let subtotal = 0;
    let resolvedItems: Array<{ productId: number; quantity: number; price: number }> = [];

    if (isDelivered) {
      // Lock items: use existing order items and their recorded prices
      resolvedItems = existingOrder.items.map(it => ({ productId: it.productId, quantity: it.quantity, price: it.price }));
      subtotal = resolvedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    } else {
      // Resolve latest prices for provided items
      const productIds = (items || []).map(item => item.productId);
      const products = await withRetry(async () => {
        return prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, price: true }
        });
      }, 2, 'order-update-products');
      const productMap = new Map(products.map(p => [p.id, p.price]));
      resolvedItems = (items || []).map(it => ({ productId: it.productId, quantity: it.quantity, price: productMap.get(it.productId) || 0 }));
      subtotal = resolvedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    }

    const ongkirValue = isWhatsAppOutlet ? Math.round(Number(ongkirPlan || 0)) : 0;
    const afterDiscount = discount 
      ? Math.round(subtotal * (1 - discount / 100))
      : subtotal;
    const totalAmount = afterDiscount + ongkirValue;

    let shouldRegenerateSnap = false;
    if (isWhatsAppOutlet && !isDelivered) {
      const existingSignature = existingOrder.items
        .map((it) => `${it.productId}:${it.quantity}`)
        .sort()
        .join("|");
      const nextSignature = resolvedItems
        .map((it) => `${it.productId}:${it.quantity}`)
        .sort()
        .join("|");
      const itemsChanged = existingSignature !== nextSignature;
      const totalChanged = Math.round(existingOrder.totalAmount ?? 0) !== Math.round(totalAmount);
      const ongkirChanged = Math.round(existingOrder.ongkirPlan ?? 0) !== Math.round(ongkirValue);
      shouldRegenerateSnap = itemsChanged || totalChanged || ongkirChanged;
    }

    // Use transaction to update order and items
    const updatedOrder = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        if (!isDelivered) {
          // Replace items only if not delivered
          await tx.orderItem.deleteMany({
            where: { orderId: orderId }
          });
        }

        // Update order
        await tx.order.update({
          where: { id: orderId },
          data: {
            outlet,
            customer: customer || null,
            status: normalizeOrderStatus(status),
            orderDate: new Date(orderDate),
            deliveryDate: new Date(deliveryDate),
            location,
            discount: typeof discount === "number" && Number.isFinite(discount) ? discount : null,
            totalAmount,
            actPayout: actPayout || null,
            ongkirPlan: isWhatsAppOutlet ? ongkirValue : null,
          },
        });

        if (!isDelivered) {
          // Create new order items
          for (const item of resolvedItems) {
            await tx.orderItem.create({
              data: {
                orderId: orderId,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              }
            });
          }
        }

        return tx.order.findUnique({
          where: { id: orderId },
          select: ORDER_SELECT,
        });
      });
    }, 2, 'order-update-transaction');

    let finalOrder = updatedOrder;

    if (shouldRegenerateSnap) {
      try {
        const snapItems = resolvedItems.map((item) => {
          const matching = finalOrder.items.find((it) => it.productId === item.productId);
          const product = matching?.product;
          return {
            id: (product?.id || item.productId).toString(),
            price: item.price,
            quantity: item.quantity,
            name: product?.name || product?.code || `Product ${item.productId}`,
          };
        });
        if (ongkirValue > 0) {
          snapItems.push({
            id: "ONGKIR",
            price: ongkirValue,
            quantity: 1,
            name: "Ongkir",
          });
        }
        const snap = await createSnapTransaction({
          orderId: `WA-${orderId}-${Date.now()}`,
          grossAmount: totalAmount,
          customer: customer || existingOrder.customer || "Customer",
          items: snapItems,
          expiryMinutes: MIDTRANS_EXPIRY_MINUTES,
        });

        finalOrder = await withRetry(async () => {
          return prisma.order.update({
            where: { id: orderId },
            data: {
              paymentLink: snap.redirectUrl,
              midtransOrderId: snap.orderId,
              midtransTransactionId: snap.token,
            },
            select: ORDER_SELECT,
          });
        }, 2, "order-update-attach-payment");
      } catch (error) {
        return NextResponse.json(createErrorResponse("regenerate payment link", error), {
          status: 500,
        });
      }
    }

    logRouteComplete('order-update');
    return NextResponse.json(finalOrder);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("update order", error), 
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('order-delete');

    const { id } = await params;
    const orderId = parseInt(id);
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart("order-patch");
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }
    const payload = await req.json().catch(() => ({}));
    if (payload?.action !== "manual-paid") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const updated = await withRetry(async () => {
      return prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          paymentLink: null,
          midtransOrderId: null,
          midtransTransactionId: null,
        },
        select: ORDER_SELECT,
      });
    }, 2, "order-manual-paid");

    logRouteComplete("order-patch");
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(createErrorResponse("manual paid", error), {
      status: 500,
    });
  }
}
