import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { parseBarcode } from "../../../../lib/barcode";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, location } = body as { barcode: string; location: string };
    if (!barcode || !location) {
      return NextResponse.json({ error: "barcode and location are required" }, { status: 400 });
    }

    const parsed = parseBarcode(barcode);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid barcode format" }, { status: 400 });
    }

    // Map to master code (e.g., HOK-L, HOK-R, BRW)
    const product = await prisma.product.findUnique({ where: { code: parsed.masterCode } });
    if (!product) {
      return NextResponse.json({ error: "Product not found for barcode" }, { status: 404 });
    }

    const created = await prisma.inventory.create({
      data: {
        barcode: parsed.raw,
        location,
        productId: product.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Barcode already exists in inventory" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add inventory" }, { status: 500 });
  }
}


