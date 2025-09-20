import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(products);
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const created = await prisma.product.create({
      data: { code: code.toUpperCase(), name, price, hppPct, hppValue },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Product code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}


