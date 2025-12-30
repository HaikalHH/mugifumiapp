import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createErrorResponse, logRouteStart, logRouteComplete, withRetry } from "../../../../../lib/db-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { location, items } = body as {
      location?: string;
      items?: Array<{ productId: number; barcodes: string[] }>;
    };
    if (!location) {
      return NextResponse.json({ error: "location required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    logRouteStart("b2b-orders-validate-barcodes", { location, items: items.length });

    const flat = items.flatMap((it) =>
      (it.barcodes || []).map((code) => ({
        productId: Number(it.productId),
        barcode: String(code || "").trim().toUpperCase(),
      })),
    );

    const barcodes = flat.map((f) => f.barcode).filter(Boolean);
    if (barcodes.length === 0) {
      return NextResponse.json({ error: "barcodes required" }, { status: 400 });
    }

    const inv = await withRetry(
      async () =>
        prisma.inventory.findMany({
          where: { barcode: { in: barcodes }, status: "READY", location },
          select: { barcode: true, productId: true, location: true },
        }),
      2,
      "b2b-orders-validate-barcodes"
    );
    const map = new Map(inv.map((v) => [v.barcode, v]));

    for (const f of flat) {
      if (!f.barcode) return NextResponse.json({ error: "Barcode tidak boleh kosong" }, { status: 400 });
      const hit = map.get(f.barcode);
      if (!hit) return NextResponse.json({ error: `Barcode ${f.barcode} tidak READY di lokasi ${location}` }, { status: 400 });
      if (hit.productId !== f.productId) return NextResponse.json({ error: `Barcode ${f.barcode} bukan untuk produk yang dipilih` }, { status: 400 });
    }

    logRouteComplete("b2b-orders-validate-barcodes", barcodes.length);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("validate barcodes", error), { status: 500 });
  }
}
