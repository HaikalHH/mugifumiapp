import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: itemIdString } = await params;
  const itemId = Number(itemIdString);
  if (Number.isNaN(itemId)) return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  try {
    const body = await req.json();
    const { status, price } = body as Partial<{ status: string; price: number }>;
    const data: any = {};
    if (typeof status === "string") data.status = status;
    if (typeof price === "number") data.price = price;
    const updated = await prisma.saleItem.update({ where: { id: itemId }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to update sale item" }, { status: 500 });
  }
}

// Delete sale item -> return barcode back to inventory
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: itemIdString } = await params;
  const itemId = Number(itemIdString);
  if (Number.isNaN(itemId)) return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.saleItem.delete({ where: { id: itemId } });
      // Restore inventory status to READY (barcode must exist)
      await tx.inventory.update({ where: { barcode: item.barcode }, data: { status: "READY" } });
      return item;
    });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete sale item" }, { status: 500 });
  }
}


