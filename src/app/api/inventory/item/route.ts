import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// Hard-delete an inventory record by barcode
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get("barcode");
    if (!barcode) return NextResponse.json({ error: "barcode is required" }, { status: 400 });
    await prisma.inventory.delete({ where: { barcode: barcode.toUpperCase() } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete inventory" }, { status: 500 });
  }
}


