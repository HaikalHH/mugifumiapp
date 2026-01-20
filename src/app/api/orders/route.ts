import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";
import { createSnapTransaction } from "../../../lib/midtrans";

function normalizeOrderStatus(rawStatus?: string | null): "PAID" | "NOT PAID" {
  if (!rawStatus) return "PAID";
  const normalized = rawStatus.trim().toUpperCase().replace(/\s+/g, " ");
  if (normalized === "NOT PAID" || normalized === "NOT_PAID") {
    return "NOT PAID";
  }
  return "PAID";
}

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
  selfPickup: true,
  paymentLink: true,
  midtransOrderId: true,
  midtransTransactionId: true,
  midtransFee: true,
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
} as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "10");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search");
    const outletFilter = searchParams.get("outlet");
    const excludeOutlet = searchParams.get("excludeOutlet");
    
    logRouteStart('orders-list', { page, pageSize, from, to, search });

    const where: any = {};
    if (outletFilter) where.outlet = outletFilter;
    if (excludeOutlet) where.outlet = { not: excludeOutlet };
    if (from || to) {
      where.orderDate = {};
      if (from) {
        // Frontend already sends Asia/Jakarta timezone converted to UTC
        where.orderDate.gte = new Date(from);
      }
      if (to) {
        // Frontend already sends Asia/Jakarta timezone converted to UTC
        where.orderDate.lte = new Date(to);
      }
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchConditions = [];
      
      // Only search by ID if the search term is a valid integer and not too large
      const numericSearch = Number(searchTerm);
      if (!Number.isNaN(numericSearch) && numericSearch > 0 && numericSearch <= 2147483647) {
        searchConditions.push({ id: { equals: numericSearch } });
      }
      
      // Add text-based searches
      searchConditions.push(
        // Search by outlet (case insensitive)
        { outlet: { contains: searchTerm, mode: 'insensitive' } },
        // Search by location (case insensitive)
        { location: { contains: searchTerm, mode: 'insensitive' } },
        // Search by customer (case insensitive)
        { customer: { contains: searchTerm, mode: 'insensitive' } },
        // Search by status (case insensitive)
        { status: { contains: searchTerm, mode: 'insensitive' } }
      );
      
      where.OR = searchConditions;
    }

    const rows = await withRetry(async () => {
      return prisma.order.findMany({
        where,
        orderBy: { id: 'desc' },
        select: ORDER_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    }, 2, 'orders-list-rows');

    const total = await withRetry(async () => {
      return prisma.order.count({ where });
    }, 2, 'orders-list-count');

    logRouteComplete('orders-list', rows.length);
    return NextResponse.json({ rows, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch orders", error), 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart('orders-create');

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
      selfPickup,
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
      selfPickup?: boolean;
    };

    const normalizedLocation = String(location || "").trim();

    if (!outlet || !normalizedLocation) {
      return NextResponse.json({ error: "outlet and location are required" }, { status: 400 });
    }
    if (!orderDate) {
      return NextResponse.json({ error: "orderDate is required" }, { status: 400 });
    }
    if (!deliveryDate) {
      return NextResponse.json({ error: "deliveryDate is required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "at least one item is required" }, { status: 400 });
    }

    const isWhatsAppOutlet = outlet.toLowerCase() === "whatsapp";
    const normalizedSelfPickup = isWhatsAppOutlet ? Boolean(selfPickup) : false;

    if (isWhatsAppOutlet && !normalizedSelfPickup) {
      if (ongkirPlan === undefined || ongkirPlan === null || Number.isNaN(Number(ongkirPlan)) || Number(ongkirPlan) <= 0) {
        return NextResponse.json({ error: "ongkirPlan is required for WhatsApp orders" }, { status: 400 });
      }
    }

    const normalizedItemsMap = new Map<number, { productId: number; quantity: number }>();
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "each item quantity must be a positive number" }, { status: 400 });
      }
      const prev = normalizedItemsMap.get(item.productId);
      if (prev) {
        prev.quantity += qty;
      } else {
        normalizedItemsMap.set(item.productId, { productId: item.productId, quantity: qty });
      }
    }
    const normalizedItems = Array.from(normalizedItemsMap.values());

    // Resolve products up front so we can also reuse for Snap payload
    const productIds = normalizedItems.map((item) => item.productId);
    const products = await withRetry(async () => {
      return prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, price: true, name: true, code: true },
      });
    }, 2, "orders-create-products");

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of normalizedItems) {
      if (!productMap.has(item.productId)) {
        return NextResponse.json({ error: `Product with id ${item.productId} not found` }, { status: 400 });
      }
    }

    const subtotal = normalizedItems.reduce((acc, item) => {
      const product = productMap.get(item.productId)!;
      return acc + product.price * item.quantity;
    }, 0);

    const ongkirValue = isWhatsAppOutlet && !normalizedSelfPickup ? Math.round(Number(ongkirPlan)) : 0;
    const subtotalAfterDiscount = discount
      ? Math.round(subtotal * (1 - discount / 100))
      : subtotal;
    const totalAmount = subtotalAfterDiscount + ongkirValue;

    const normalizedStatus = isWhatsAppOutlet ? "NOT PAID" : normalizeOrderStatus(status);
    const normalizedActPayout = isWhatsAppOutlet ? null : actPayout || null;

    const created = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            outlet,
            customer: customer || null,
            status: normalizedStatus,
            orderDate: new Date(orderDate),
            deliveryDate: new Date(deliveryDate),
            location: normalizedLocation,
            discount: typeof discount === "number" && Number.isFinite(discount) ? discount : null,
            totalAmount,
            actPayout: normalizedActPayout,
            ongkirPlan: isWhatsAppOutlet && !normalizedSelfPickup ? Math.round(Number(ongkirPlan)) : null,
            selfPickup: normalizedSelfPickup,
            paymentLink: null,
            midtransOrderId: null,
            midtransTransactionId: null,
          },
          select: ORDER_SELECT,
        });

        const orderItems = await Promise.all(
          normalizedItems.map((item) =>
            tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: item.productId,
                quantity: item.quantity,
                price: productMap.get(item.productId)!.price,
              },
              select: ORDER_SELECT.items.select,
            })
          )
        );

        return { ...order, items: orderItems, deliveries: order.deliveries || [] };
      });
    }, 2, "orders-create");

    let responsePayload = created;

    if (isWhatsAppOutlet) {
      const midtransOrderId = `WA-${created.id}-${Date.now()}`;
      const snapItems = normalizedItems.map((item) => {
        const product = productMap.get(item.productId)!;
        return {
          id: product.id.toString(),
          price: product.price,
          quantity: item.quantity,
          name: product.name || product.code || `Product ${product.id}`,
        };
      });
      const discountValue = subtotal - subtotalAfterDiscount;
      if (discountValue > 0) {
        snapItems.push({
          id: "DISCOUNT",
          price: -discountValue,
          quantity: 1,
          name: "Discount",
        });
      }
      if (ongkirValue > 0) {
        snapItems.push({
          id: "ONGKIR",
          price: ongkirValue,
          quantity: 1,
          name: "Ongkir",
        });
      }

      try {
        const snap = await createSnapTransaction({
          orderId: midtransOrderId,
          grossAmount: totalAmount,
          customer: customer || "Customer",
          items: snapItems,
          expiryMinutes: MIDTRANS_EXPIRY_MINUTES,
        });

        const updated = await withRetry(async () => {
          return prisma.order.update({
            where: { id: created.id },
            data: {
              paymentLink: snap.redirectUrl,
              midtransOrderId: snap.orderId,
              midtransTransactionId: snap.token,
            },
            select: ORDER_SELECT,
          });
        }, 2, "orders-create-update-payment");

        responsePayload = updated;
      } catch (err) {
        // Cleanup half-created order if Snap failed
        await withRetry(async () => {
          return prisma.$transaction(async (tx) => {
            await tx.orderItem.deleteMany({ where: { orderId: created.id } });
            await tx.delivery.deleteMany({ where: { orderId: created.id } });
            await tx.order.delete({ where: { id: created.id } });
          });
        }, 1, "orders-create-cleanup");
        throw err;
      }
    }

    logRouteComplete('orders-create', 1);
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      createErrorResponse("create order", e), 
      { status: 500 }
    );
  }
}
