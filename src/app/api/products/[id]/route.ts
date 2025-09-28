import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('product-get');

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const product = await withRetry(async () => {
      return prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          hppPct: true,
          hppValue: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }, 2, 'product-get');

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    logRouteComplete('product-get');
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("get product", error), 
      { status: 500 }
    );
  }
}