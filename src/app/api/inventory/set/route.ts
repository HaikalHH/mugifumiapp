import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

const VALID_LOCATIONS = new Set(["Bandung", "Jakarta"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const productId = Number(body?.productId);
    const location = String(body?.location || "");
    const rawQuantity = Number(body?.quantity);
    const quantity = Number.isFinite(rawQuantity) ? Math.max(0, Math.floor(rawQuantity)) : NaN;

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!VALID_LOCATIONS.has(location)) {
      return NextResponse.json({ error: "location must be Bandung or Jakarta" }, { status: 400 });
    }
    if (Number.isNaN(quantity)) {
      return NextResponse.json({ error: "quantity is required" }, { status: 400 });
    }

    logRouteStart("inventory-set", { productId, location, quantity });

    const result = await withRetry(
      async () => {
        return prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true, code: true, name: true },
          });
          if (!product) {
            throw new Error("Product not found");
          }

          const existing = await tx.inventory.findMany({
            where: { productId, location, status: "READY" },
            select: { id: true },
            orderBy: { id: "asc" },
          });

          const currentCount = existing.length;
          if (quantity === currentCount) {
            return { product, location, quantity };
          }

          if (quantity < currentCount) {
            const removeIds = existing
              .slice(0, currentCount - quantity)
              .map((item) => item.id);
            if (removeIds.length > 0) {
              await tx.inventory.deleteMany({
                where: { id: { in: removeIds } },
              });
            }
          } else {
            const toAdd = quantity - currentCount;
            const insertData = Array.from({ length: toAdd }).map((_, idx) => {
              const unique = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
              return {
                barcode: `AUTO-${product.code}-${unique}`,
                location,
                productId,
                status: "READY" as const,
              };
            });
            if (insertData.length > 0) {
              await tx.inventory.createMany({ data: insertData });
            }
          }

          return { product, location, quantity };
        });
      },
      2,
      "inventory-set",
    );

    logRouteComplete("inventory-set", 1);
    return NextResponse.json({
      success: true,
      productId: result.product.id,
      location: result.location,
      quantity: result.quantity,
    });
  } catch (error) {
    return NextResponse.json(createErrorResponse("set inventory stock", error), {
      status: 500,
    });
  }
}
