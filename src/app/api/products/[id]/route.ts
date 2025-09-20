import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idString } = await params;
    const id = Number(idString);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idString } = await params;
    const id = Number(idString);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const { name, price, hppPct } = body as Partial<{
      name: string;
      price: number;
      hppPct: number;
    }>;

    const data: any = {};
    if (typeof name === "string") data.name = name;
    if (typeof price === "number") data.price = price;
    if (typeof hppPct === "number") data.hppPct = hppPct;
    if (data.price != null && data.hppPct != null) {
      data.hppValue = Math.round(data.price * data.hppPct);
    }

    const updated = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idString } = await params;
    const id = Number(idString);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}


