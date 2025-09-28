import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../../lib/db-utils";

type Params = { params: Promise<{ id: string }> };

// Add item by barcode -> deduct from inventory
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const saleId = Number(id);
    if (Number.isNaN(saleId)) return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
    
    logRouteStart('sales-item-add', { saleId });
    
    const body = await req.json();
    const { barcode, status } = body as { barcode: string; status?: string };
    if (!barcode) return NextResponse.json({ error: "barcode is required" }, { status: 400 });

    // Find inventory item
    const inv = await withRetry(async () => {
      return prisma.inventory.findUnique({ where: { barcode: barcode.toUpperCase() }, include: { product: true } });
    }, 2, 'sales-item-inventory');
    
    if (!inv) return NextResponse.json({ error: "Barcode not in inventory" }, { status: 404 });
    if (inv.status !== "READY") return NextResponse.json({ error: "Barcode not available (status not READY)" }, { status: 409 });

    // Create item and remove inventory in a transaction
    const result = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({ where: { id: saleId } });
        if (!sale) throw new Error("SALE_NOT_FOUND");

        const item = await tx.saleItem.create({
          data: {
            saleId,
            productId: inv.productId,
            barcode: inv.barcode,
            price: inv.product.price,
            status: status || null,
          },
        });

        // mark inventory as SOLD instead of deleting
        await tx.inventory.update({ where: { barcode: inv.barcode }, data: { status: "SOLD" } });

        return item;
      });
    }, 2, 'sales-item-transaction');

    logRouteComplete('sales-item-add');
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error?.message === "SALE_NOT_FOUND") return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    return NextResponse.json(
      createErrorResponse("add sale item", error), 
      { status: 500 }
    );
  }
}

// List items for a sale
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const saleId = Number(id);
    if (Number.isNaN(saleId)) return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
    
    logRouteStart('sales-items-list', { saleId });
    
    const items = await withRetry(async () => {
      return prisma.saleItem.findMany({ where: { saleId } });
    }, 2, 'sales-items-list');
    
    logRouteComplete('sales-items-list');
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch sale items", error), 
      { status: 500 }
    );
  }
}


