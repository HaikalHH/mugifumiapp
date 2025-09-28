import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../../lib/db-utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('delivery-cancel');

    const { id } = await params;
    const deliveryId = parseInt(id);
    if (isNaN(deliveryId)) {
      return NextResponse.json({ error: "Invalid delivery ID" }, { status: 400 });
    }

    // Get delivery with order and items
    const delivery = await withRetry(async () => {
      return prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          order: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });
    }, 2, 'delivery-cancel-find');

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    if (delivery.status !== "delivered") {
      return NextResponse.json({ error: "Only delivered deliveries can be cancelled" }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // Update inventory items back to READY
        for (const item of delivery.items) {
          await tx.inventory.updateMany({
            where: {
              barcode: item.barcode,
              status: "SOLD"
            },
            data: {
              status: "READY"
            }
          });
        }

        // Delete delivery items
        await tx.deliveryItem.deleteMany({
          where: { deliveryId: deliveryId }
        });

        // Delete delivery
        await tx.delivery.delete({
          where: { id: deliveryId }
        });
      });
    }, 2, 'delivery-cancel-transaction');

    logRouteComplete('delivery-cancel');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("cancel delivery", error), 
      { status: 500 }
    );
  }
}
