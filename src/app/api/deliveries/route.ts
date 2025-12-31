import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";
import { sendDeliveryNotification, DeliveryNotificationData } from "../../../lib/ultramsg";

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
          ongkirPlan: true,
          ongkirActual: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              outlet: true,
              customer: true,
              orderDate: true,
              deliveryDate: true,
              location: true,
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
    logRouteStart("deliveries-create");

    const body = await req.json();
    const {
      orderId,
      deliveryDate,
      ongkirActual,
      items,
      forceRefund,
    } = body as {
      orderId: number;
      deliveryDate?: string;
      ongkirActual?: number;
      items?: Array<{ productId: number; quantity: number }>;
      forceRefund?: boolean;
    };

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items is required" }, { status: 400 });
    }

    const normalized = items
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Math.max(0, Math.floor(Number(item.quantity))),
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (normalized.length === 0) {
      return NextResponse.json({ error: "at least one product quantity must be greater than zero" }, { status: 400 });
    }

    const confirmError = (details: Array<{ productId: number; code: string; name?: string | null; requested: number; available: number }>) => {
      const err = new Error("DELIVERY_REFUND_CONFIRM");
      (err as any).code = "DELIVERY_REFUND_CONFIRM";
      (err as any).shortages = details;
      return err;
    };

    const created = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            ongkirPlan: true,
            outlet: true,
            customer: true,
            location: true,
            totalAmount: true,
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
          },
        });

        if (!order) {
          throw new Error("Order not found");
        }

        const orderItemMap = new Map<
          number,
          {
            id: number;
            qty: number;
            price: number;
            product: { code?: string | null; price: number; name?: string | null };
          }
        >();
        for (const orderItem of order.items) {
          orderItemMap.set(orderItem.productId, {
            id: orderItem.id,
            qty: orderItem.quantity,
            price: orderItem.price,
            product: {
              code: orderItem.product?.code,
              price: orderItem.product?.price || 0,
              name: orderItem.product?.name,
            },
          });
        }

        const requestedMap = new Map<number, number>();
        for (const item of normalized) {
          if (!orderItemMap.has(item.productId)) {
            throw new Error(`Product ${item.productId} is not in the order`);
          }
          requestedMap.set(item.productId, (requestedMap.get(item.productId) || 0) + item.quantity);
        }

        if (requestedMap.size === 0) {
          throw new Error("No valid items to deliver");
        }

        if (!forceRefund) {
          const shortages: Array<{ productId: number; code: string; name?: string | null; requested: number; available: number }> = [];
          for (const [productId, quantity] of requestedMap.entries()) {
            const available = await tx.inventory.count({
              where: {
                productId,
                status: "READY",
                location: order.location,
              },
            });
            if (available < quantity) {
              const info = orderItemMap.get(productId)!;
              shortages.push({
                productId,
                code: info.product.code || String(productId),
                name: info.product.name,
                requested: quantity,
                available,
              });
            }
          }
          if (shortages.length > 0) {
            throw confirmError(shortages);
          }
        }

        const inventoryUsages: Array<{ productId: number; barcode: string; price: number }> = [];
        const boxItems: Array<{ productId: number; code: string; price: number; quantity: number }> = [];
        const orderItemUpdates: Promise<unknown>[] = [];
        const processedProducts = new Set<number>();
        const refunds: Array<{ productId: number; name: string; code: string; quantity: number }> = [];
        let refundAmount = 0;

        for (const [productId, requestedQuantity] of requestedMap.entries()) {
          const orderInfo = orderItemMap.get(productId)!;
          if (requestedQuantity > orderInfo.qty) {
            throw new Error(
              `Quantity for product ${orderInfo.product.code || productId} exceeds order quantity (${orderInfo.qty})`,
            );
          }
          const code = (orderInfo.product.code || "").toUpperCase();
          const isBox = code.startsWith("BOX-");
          const price = orderInfo.product.price || 0;
          let fulfilledQuantity = requestedQuantity;

          if (isBox) {
            if (fulfilledQuantity > 0) {
              boxItems.push({ productId, code, price, quantity: fulfilledQuantity });
            }
          } else {
            const inventory = await tx.inventory.findMany({
              where: {
                productId,
                status: "READY",
                location: order.location,
              },
              select: {
                id: true,
                barcode: true,
              },
              orderBy: { id: "asc" },
              take: requestedQuantity,
            });

            fulfilledQuantity = Math.min(requestedQuantity, inventory.length);
            const usableItems = inventory.slice(0, fulfilledQuantity);
            const ids = usableItems.map((inv) => inv.id);
            if (ids.length > 0) {
              await tx.inventory.updateMany({
                where: { id: { in: ids } },
                data: { status: "SOLD" },
              });
            }

            for (const inv of usableItems) {
              inventoryUsages.push({ productId, barcode: inv.barcode, price });
            }
          }

          const diff = orderInfo.qty - fulfilledQuantity;
          if (diff > 0) {
            refunds.push({
              productId,
              name: orderInfo.product.name || `Produk ${productId}`,
              code: code || "-",
              quantity: diff,
            });
            refundAmount += diff * orderInfo.price;
            if (fulfilledQuantity === 0) {
              orderItemUpdates.push(tx.orderItem.delete({ where: { id: orderInfo.id } }));
            } else {
              orderItemUpdates.push(
                tx.orderItem.update({
                  where: { id: orderInfo.id },
                  data: { quantity: fulfilledQuantity },
                }),
              );
            }
          }

          processedProducts.add(productId);
        }

        for (const orderItem of order.items) {
          if (processedProducts.has(orderItem.productId)) continue;
          if (orderItem.quantity <= 0) continue;
          const code = (orderItem.product?.code || "").toUpperCase();
          refunds.push({
            productId: orderItem.productId,
            name: orderItem.product?.name || `Produk ${orderItem.productId}`,
            code: code || "-",
            quantity: orderItem.quantity,
          });
          refundAmount += orderItem.quantity * orderItem.price;
          orderItemUpdates.push(tx.orderItem.delete({ where: { id: orderItem.id } }));
        }

        if (orderItemUpdates.length > 0) {
          await Promise.all(orderItemUpdates);
          if (refundAmount > 0 && order.totalAmount !== null && order.totalAmount !== undefined) {
            await tx.order.update({
              where: { id: order.id },
              data: { totalAmount: Math.max(0, order.totalAmount - refundAmount) },
            });
          }
        }

        const delivery = await tx.delivery.create({
          data: {
            orderId,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            status: deliveryDate ? "delivered" : "pending",
            ongkirPlan: order.ongkirPlan || null,
            ongkirActual: ongkirActual || null,
          },
          select: {
            id: true,
            orderId: true,
            deliveryDate: true,
            status: true,
            ongkirPlan: true,
            createdAt: true,
          },
        });

        const deliveryItems: Array<{
          id: number;
          productId: number;
          barcode: string;
          price: number;
          product: { id: number; code: string; name: string };
        }> = [];

        for (const usage of inventoryUsages) {
          const item = await tx.deliveryItem.create({
            data: {
              deliveryId: delivery.id,
              productId: usage.productId,
              barcode: usage.barcode.toUpperCase(),
              price: usage.price,
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
                  name: true,
                },
              },
            },
          });
          deliveryItems.push(item);
        }

        for (const box of boxItems) {
          for (let i = 0; i < box.quantity; i++) {
            const barcode = `BOX-AUTO-${box.code}-${Date.now()}-${i}`;
            const item = await tx.deliveryItem.create({
              data: {
                deliveryId: delivery.id,
                productId: box.productId,
                barcode,
                price: box.price,
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
                    name: true,
                  },
                },
              },
            });
            deliveryItems.push(item);
          }
        }

        if (deliveryItems.length === 0) {
          throw new Error("Tidak ada item yang dikirim");
        }

        return { ...delivery, items: deliveryItems, refunds };
      });
    }, 2, "deliveries-create");

    // Send WhatsApp notification if ongkir fields are provided
    if (created.ongkirPlan !== null && created.ongkirPlan !== undefined && ongkirActual !== undefined) {
      try {
        // Get order details for notification
        const orderDetails = await withRetry(async () => {
          return prisma.order.findUnique({
            where: { id: orderId },
            select: {
              outlet: true,
              customer: true,
              location: true
            }
          });
        }, 2, 'deliveries-get-order-details');

        if (orderDetails) {
          const planValue = created.ongkirPlan || 0;
          const costDifference = ongkirActual - planValue;
          const costDifferencePercent = planValue > 0 ? (costDifference / planValue) * 100 : 0;

          const notificationData: DeliveryNotificationData = {
            outlet: orderDetails.outlet,
            location: orderDetails.location,
            customer: orderDetails.customer || "-",
            orderId: orderId,
            deliveryDate: created.deliveryDate?.toISOString() || new Date().toISOString(),
            ongkirPlan: planValue,
            ongkirActual,
            costDifference,
            costDifferencePercent,
            items: created.items.map(item => ({
              name: item.product.name,
              barcode: item.barcode,
              price: item.price
            }))
          };

          await sendDeliveryNotification(notificationData);
        }
      } catch (error) {
        console.error("Error sending delivery notification:", error);
        // Don't fail the delivery creation if notification fails
      }
    }

    logRouteComplete('deliveries-create', 1);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === "DELIVERY_REFUND_CONFIRM") {
      return NextResponse.json(
        {
          error: "Konfirmasi refund diperlukan",
          code: "DELIVERY_REFUND_CONFIRM",
          shortages: e.shortages || [],
        },
        { status: 409 },
      );
    }
    return NextResponse.json(createErrorResponse("create delivery", e), { status: 500 });
  }
}
