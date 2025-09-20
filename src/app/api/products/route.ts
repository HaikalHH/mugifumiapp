import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET() {
  try {
    logRouteStart('products-list');

    const products = await withRetry(async () => {
      return prisma.product.findMany({ 
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          hppPct: true,
          hppValue: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { id: 'desc' } 
      });
    }, 2, 'products-list');

    logRouteComplete('products-list', products.length);
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch products", error), 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart('products-create');

    const body = await req.json();
    const { code, name, price, hppPct } = body as {
      code: string;
      name: string;
      price: number;
      hppPct: number;
    };

    if (!code || !name || typeof price !== "number" || typeof hppPct !== "number") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const hppValue = Math.round(price * hppPct);

    const created = await withRetry(async () => {
      return prisma.product.create({
        data: { 
          code: code.toUpperCase(), 
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
    }, 2, 'products-create');

    logRouteComplete('products-create', 1);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Product code already exists" }, { status: 409 });
    }
    return NextResponse.json(
      createErrorResponse("create product", error), 
      { status: 500 }
    );
  }
}


