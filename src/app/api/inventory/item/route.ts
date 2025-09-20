import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

// Hard-delete an inventory record by barcode
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get("barcode");
    
    if (!barcode) return NextResponse.json({ error: "barcode is required" }, { status: 400 });
    
    logRouteStart('inventory-delete', { barcode });

    await withRetry(async () => {
      return prisma.inventory.delete({ 
        where: { barcode: barcode.toUpperCase() },
        select: { id: true, barcode: true }
      });
    }, 2, 'inventory-delete');

    logRouteComplete('inventory-delete', 1);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
    }
    return NextResponse.json(
      createErrorResponse("delete inventory", error), 
      { status: 500 }
    );
  }
}


