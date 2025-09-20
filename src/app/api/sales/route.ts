import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "10");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: any = {};
    if (from || to) {
      where.orderDate = {};
      if (from) where.orderDate.gte = new Date(from);
      if (to) where.orderDate.lte = new Date(to);
    }
    const [rows, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { items: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sale.count({ where }),
    ]);
    return NextResponse.json({ rows, total, page, pageSize });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      outlet,
      customer,
      status,
      orderDate,
      shipDate,
      estPayout,
      actPayout,
      location,
      discount,
      actualReceived,
      items,
    } = body as {
      outlet: string;
      customer?: string;
      status?: string;
      orderDate?: string;
      shipDate?: string | null;
      estPayout?: number | null;
      actPayout?: number | null;
      location: string;
      discount?: number | null;
      actualReceived?: number | null;
      items?: string[]; // barcodes
    };

    if (!outlet || !location) {
      return NextResponse.json({ error: "outlet and location are required" }, { status: 400 });
    }

    const defaultStatusForOutlet = (ot: string): string => {
      const key = ot.toLowerCase();
      if (key === "tokopedia" || key === "shopee" || key === "whatsapp" || key === "free") return "ordered";
      if (key === "wholesale") return "shipping";
      if (key === "cafe") return "Display"; // cafe default at header
      return "ordered";
    };
    const headerStatus = status || defaultStatusForOutlet(outlet);

    // Normalize actual received (accept either actualReceived or actPayout from clients)
    const actualValue: number | null =
      typeof actualReceived === "number" && Number.isFinite(actualReceived)
        ? actualReceived
        : typeof actPayout === "number" && Number.isFinite(actPayout)
        ? actPayout
        : null;

    // If items provided, create sale and items in a single transaction and deduct inventory
    if (Array.isArray(items) && items.length > 0) {
      const created = await prisma.$transaction(async (tx) => {
        // Validate inventory availability, status READY and location match
        const upperBarcodes = items.map((b) => String(b).toUpperCase());
        const invItems = await tx.inventory.findMany({
          where: {
            barcode: { in: upperBarcodes },
            status: "READY",
            location,
          },
          include: { product: true },
        });
        if (invItems.length !== upperBarcodes.length) {
          throw new Error("SOME_BARCODES_NOT_READY_OR_WRONG_LOCATION");
        }

        // Compute subtotal and estimated payout before creating sale
        const subtotal = invItems.reduce((acc, it) => acc + it.product.price, 0);
        // Per latest rule: estPayout is always the total from scanned items (no discount applied)
        const estTotal = subtotal;

        const sale = await tx.sale.create({
          data: {
            outlet,
            customer: customer || null,
            status: headerStatus,
            orderDate: orderDate ? new Date(orderDate) : new Date(),
            shipDate: shipDate ? new Date(shipDate) : null,
            estPayout: estTotal,
            // For WhatsApp/Cafe: if actual not provided, auto = est minus discount% (or est if no discount)
            actPayout:
              actualValue != null
                ? actualValue
                : ["whatsapp", "cafe"].includes(outlet.toLowerCase())
                ? Math.round(estTotal * (1 - ((typeof discount === "number" ? discount : 0) / 100)))
                : null,
            location,
            discount: typeof discount === "number" && Number.isFinite(discount) ? discount : null,
          },
        });

        // Create items and mark inventory SOLD
        for (const inv of invItems) {
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: inv.productId,
              barcode: inv.barcode,
              price: inv.product.price,
              status: outlet.toLowerCase() === "cafe" ? "Display" : null,
            },
          });
          await tx.inventory.update({ where: { barcode: inv.barcode }, data: { status: "SOLD" } });
        }

        return tx.sale.findUnique({ where: { id: sale.id }, include: { items: true } });
      });
      return NextResponse.json(created, { status: 201 });
    }

    // Otherwise, create header only (no stock changes yet)
    const headerOnly = await prisma.sale.create({
      data: {
        outlet,
        customer: customer || null,
        status: headerStatus,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        shipDate: shipDate ? new Date(shipDate) : null,
        estPayout: null,
        actPayout: actualValue,
        location,
        discount: typeof discount === "number" && Number.isFinite(discount) ? discount : null,
      },
      include: { items: true },
    });
    return NextResponse.json(headerOnly, { status: 201 });
  } catch (e: any) {
    if (e?.message === "SOME_BARCODES_NOT_READY_OR_WRONG_LOCATION") {
      return NextResponse.json({ error: "Some barcodes are not READY at the specified location" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}


