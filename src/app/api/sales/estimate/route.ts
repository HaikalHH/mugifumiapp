import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcodes, location, outlet, discount } = body as {
      barcodes: string[];
      location: string;
      outlet: string;
      discount?: number | null;
    };
    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return NextResponse.json({ subtotal: 0, total: 0 });
    }
    const upper = barcodes.map((b) => String(b).toUpperCase());
    const inv = await prisma.inventory.findMany({
      where: { barcode: { in: upper }, status: "READY", location },
      include: { product: true },
    });
    const subtotal = inv.reduce((acc, it) => acc + it.product.price, 0);
    const needsDiscount = ["whatsapp", "cafe"].includes(String(outlet).toLowerCase());
    const pct = needsDiscount && typeof discount === "number" ? discount : 0;
    const total = Math.round(subtotal * (1 - (pct || 0) / 100));
    return NextResponse.json({ subtotal, discountPct: pct, total });
  } catch {
    return NextResponse.json({ error: "Failed to estimate" }, { status: 500 });
  }
}


