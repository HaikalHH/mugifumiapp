import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, toLocation } = body as { barcode: string; toLocation: string };
    
    if (!barcode || !toLocation) {
      return NextResponse.json({ error: "barcode and toLocation are required" }, { status: 400 });
    }
    
    logRouteStart('inventory-move', { barcode, toLocation });

    const updated = await withRetry(async () => {
      return prisma.inventory.update({
        where: { barcode: barcode.toUpperCase() },
        data: { location: toLocation },
        select: {
          id: true,
          barcode: true,
          location: true,
          status: true,
          productId: true
        }
      });
    }, 2, 'inventory-move');

    logRouteComplete('inventory-move', 1);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
    }
    return NextResponse.json(
      createErrorResponse("move inventory", error), 
      { status: 500 }
    );
  }
}


