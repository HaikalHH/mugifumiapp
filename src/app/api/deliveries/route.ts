import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "10");
    const location = searchParams.get("location");
    const search = searchParams.get("search");
    
    logRouteStart('deliveries-list', { page, pageSize, location, search });

    const where: any = {};
    if (location && location !== "all") {
      where.order = {
        location: location
      };
    }

    if (search) {
      where.order = {
        ...where.order,
        OR: [
          { customer: { contains: search } },
          { outlet: { contains: search } }
        ]
      };
    }

    const rows = await withRetry(async () => {
      return prisma.delivery.findMany({
        where,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          orderId: true,
          deliveryDate: true,
          status: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              outlet: true,
              customer: true,
              orderDate: true,
              location: true,
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
                      name: true
                    }
                  }
                }
              }
            }
          },
          items: {
            select: {
              id: true,
              productId: true,
              barcode: true,
              price: true,
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    }, 2, 'deliveries-list-rows');

    const total = await withRetry(async () => {
      return prisma.delivery.count({ where });
    }, 2, 'deliveries-list-count');

    logRouteComplete('deliveries-list', rows.length);
    return NextResponse.json({ rows, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch deliveries", error), 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart('deliveries-create');

    const body = await req.json();
    const {
      orderId,
      deliveryDate,
      items, // Array of { productId, barcode }
    } = body as {
      orderId: number;
      deliveryDate?: string;
      items?: Array<{ productId: number; barcode: string }>;
    };

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "at least one item is required" }, { status: 400 });
    }

    const created = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // Get order and its items
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            items: {
              select: {
                productId: true,
                quantity: true,
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

        if (!order) {
          throw new Error("Order not found");
        }

        // Validate that all scanned items match order items
        const orderItemMap = new Map();
        for (const orderItem of order.items) {
          orderItemMap.set(orderItem.productId, orderItem.quantity);
        }

        const scannedItemCounts = new Map();
        for (const item of items) {
          if (!orderItemMap.has(item.productId)) {
            throw new Error(`Product ${item.productId} is not in the order`);
          }
          scannedItemCounts.set(item.productId, (scannedItemCounts.get(item.productId) || 0) + 1);
        }

        // Validate quantities match
        for (const [productId, scannedCount] of scannedItemCounts) {
          const orderQuantity = orderItemMap.get(productId);
          if (scannedCount > orderQuantity) {
            throw new Error(`Too many items scanned for product ${productId}. Expected: ${orderQuantity}, Scanned: ${scannedCount}`);
          }
        }

        // Validate barcodes exist in inventory and are READY
        const barcodes = items.map(item => item.barcode.toUpperCase());
        const inventoryItems = await tx.inventory.findMany({
          where: {
            barcode: { in: barcodes },
            status: "READY"
          },
          select: {
            barcode: true,
            productId: true,
            product: {
              select: {
                id: true,
                price: true
              }
            }
          }
        });

        if (inventoryItems.length !== barcodes.length) {
          throw new Error("Some barcodes are not available in inventory");
        }

        const inventoryMap = new Map(inventoryItems.map(inv => [inv.barcode, inv]));

        // Create delivery
        const delivery = await tx.delivery.create({
          data: {
            orderId,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            status: deliveryDate ? "delivered" : "pending",
          },
          select: {
            id: true,
            orderId: true,
            deliveryDate: true,
            status: true,
            createdAt: true
          }
        });

        // Create delivery items and mark inventory as SOLD
        const deliveryItems = await Promise.all(
          items.map(async (item) => {
            const inventory = inventoryMap.get(item.barcode.toUpperCase());
            if (!inventory) {
              throw new Error(`Inventory not found for barcode ${item.barcode}`);
            }

            // Mark inventory as SOLD
            await tx.inventory.update({
              where: { barcode: item.barcode.toUpperCase() },
              data: { status: "SOLD" }
            });

            return tx.deliveryItem.create({
              data: {
                deliveryId: delivery.id,
                productId: item.productId,
                barcode: item.barcode.toUpperCase(),
                price: inventory.product.price,
              },
              select: {
                id: true,
                productId: true,
                barcode: true,
                price: true,
                product: {
                  select: {
                    id: true,
                    code: true,
                    name: true
                  }
                }
              }
            });
          })
        );

        return { ...delivery, items: deliveryItems };
      });
    }, 2, 'deliveries-create');

    logRouteComplete('deliveries-create', 1);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      createErrorResponse("create delivery", e), 
      { status: 500 }
    );
  }
}
