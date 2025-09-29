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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('product-update');

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, price, hppPct } = body as {
      name: string;
      price: number;
      hppPct: number;
    };

    if (!name || !price || hppPct === undefined) {
      return NextResponse.json({ error: "name, price, and hppPct are required" }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: "price must be greater than 0" }, { status: 400 });
    }

    if (hppPct < 0 || hppPct > 1) {
      return NextResponse.json({ error: "hppPct must be between 0 and 1" }, { status: 400 });
    }

    const hppValue = Math.round(price * hppPct);

    const updatedProduct = await withRetry(async () => {
      return prisma.product.update({
        where: { id: productId },
        data: {
          name,
          price,
          hppPct,
          hppValue
        },
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
    }, 2, 'product-update');

    logRouteComplete('product-update');
    return NextResponse.json(updatedProduct);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("update product", error), 
      { status: 500 }
    );
  }
}