import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../../lib/db-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId: itemIdString } = await params;
    const itemId = Number(itemIdString);
    if (Number.isNaN(itemId)) return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    
    logRouteStart('sales-item-update', { itemId });
    
    const body = await req.json();
    const { status, price } = body as Partial<{ status: string; price: number }>;
    const data: any = {};
    if (typeof status === "string") data.status = status;
    if (typeof price === "number") data.price = price;
    
    const updated = await withRetry(async () => {
      return prisma.saleItem.update({ where: { id: itemId }, data });
    }, 2, 'sales-item-update');
    
    logRouteComplete('sales-item-update');
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      createErrorResponse("update sale item", error), 
      { status: 500 }
    );
  }
}

// Delete sale item -> return barcode back to inventory
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId: itemIdString } = await params;
    const itemId = Number(itemIdString);
    if (Number.isNaN(itemId)) return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    
    logRouteStart('sales-item-delete', { itemId });
    
    const result = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const item = await tx.saleItem.delete({ where: { id: itemId } });
        // Restore inventory status to READY (barcode must exist)
        await tx.inventory.update({ where: { barcode: item.barcode }, data: { status: "READY" } });
        return item;
      });
    }, 2, 'sales-item-delete');
    
    logRouteComplete('sales-item-delete');
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      createErrorResponse("delete sale item", error), 
      { status: 500 }
    );
  }
}


