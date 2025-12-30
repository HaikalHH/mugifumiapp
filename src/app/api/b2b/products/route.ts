import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET() {
  try {
    logRouteStart("b2b-products-list");
    const products = await withRetry(async () => {
      return prisma.productB2B.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          hppPct: true,
          hppValue: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { id: "desc" },
      });
    }, 2, "b2b-products-list");
    logRouteComplete("b2b-products-list", products.length);
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json(createErrorResponse("fetch b2b products", error), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart("b2b-products-create");
    const body = await req.json();
    const { code, name, price, hppPct } = body as { code: string; name: string; price: number; hppPct?: number | null };
    if (!code || !name || typeof price !== "number") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const pct = typeof hppPct === "number" ? hppPct : null;
    const hppValue = pct != null ? Math.round(price * pct) : null;
    const created = await withRetry(async () => {
      return prisma.productB2B.create({
        data: {
          code: code.toUpperCase(),
          name,
          price,
          hppPct: pct,
          hppValue,
        },
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          hppPct: true,
          hppValue: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }, 2, "b2b-products-create");
    logRouteComplete("b2b-products-create", 1);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Product code already exists" }, { status: 409 });
    }
    return NextResponse.json(createErrorResponse("create b2b product", error), { status: 500 });
  }
}
