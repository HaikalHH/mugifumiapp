import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

function normalizeOrderStatus(rawStatus?: string | null): "PAID" | "NOT PAID" {
  if (!rawStatus) return "PAID";
  const normalized = rawStatus.trim().toUpperCase().replace(/\s+/g, " ");
  if (normalized === "NOT PAID" || normalized === "NOT_PAID") {
    return "NOT PAID";
  }
  return "PAID";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "10");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    
    logRouteStart('orders-list', { page, pageSize, from, to });

    const where: any = {};
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

    const rows = await withRetry(async () => {
      return prisma.order.findMany({
        where,
        orderBy: { id: 'desc' },
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
        },
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

    const created = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // Get product details and calculate total
        const productIds = items.map(item => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, price: true }
        });

        const productMap = new Map(products.map(p => [p.id, p]));
        
        // Validate all products exist
        for (const item of items) {
          if (!productMap.has(item.productId)) {
            throw new Error(`Product with id ${item.productId} not found`);
          }
        }

        // Calculate total amount
        const subtotal = items.reduce((acc, item) => {
          const product = productMap.get(item.productId)!;
          return acc + (product.price * item.quantity);
        }, 0);

        const totalAmount = discount 
          ? Math.round(subtotal * (1 - discount / 100))
          : subtotal;

        // Create order
        const order = await tx.order.create({
          data: {
            outlet,
            customer: customer || null,
            status: normalizeOrderStatus(status),
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
            createdAt: true
          }
        });

        // Create order items
        const orderItems = await Promise.all(
          items.map(item => 
            tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: item.productId,
                quantity: item.quantity,
                price: productMap.get(item.productId)!.price,
              },
              select: {
                id: true,
                productId: true,
                quantity: true,
                price: true,
                product: {
                  select: {
                    id: true,
                    code: true,
                    name: true
                  }
                }
              }
            })
          )
        );

        return { ...order, items: orderItems };
      });
    }, 2, 'orders-create');

    logRouteComplete('orders-create', 1);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      createErrorResponse("create order", e), 
      { status: 500 }
    );
  }
}
