import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, toLocation } = body as { barcode: string; toLocation: string };
    if (!barcode || !toLocation) {
      return NextResponse.json({ error: "barcode and toLocation are required" }, { status: 400 });
    }
    const updated = await prisma.inventory.update({
      where: { barcode: barcode.toUpperCase() },
      data: { location: toLocation },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to move inventory" }, { status: 500 });
  }
}


