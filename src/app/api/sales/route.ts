import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "10");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    
    logRouteStart('sales-list', { page, pageSize, from, to });

    const where: any = {};
    if (from || to) {
      where.orderDate = {};
      if (from) {
        // Start from beginning of the day
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        where.orderDate.gte = fromDate;
      }
      if (to) {
        // End at the end of the day (23:59:59.999)
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.orderDate.lte = toDate;
      }
    }

    // Use sequential queries instead of Promise.all for better reliability
    const rows = await withRetry(async () => {
      return prisma.sale.findMany({
        where,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          outlet: true,
          customer: true,
          status: true,
          orderDate: true,
          shipDate: true,
          estPayout: true,
          actPayout: true,
          location: true,
          discount: true,
          actualReceived: true,
          createdAt: true
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    }, 2, 'sales-list-rows');

    const total = await withRetry(async () => {
      return prisma.sale.count({ where });
    }, 2, 'sales-list-count');

    // Get sale items separately for better performance
    const saleIds = rows.map(sale => sale.id);
    const items = saleIds.length > 0 ? await withRetry(async () => {
      return prisma.saleItem.findMany({
        where: { saleId: { in: saleIds } },
        select: {
          id: true,
          saleId: true,
          productId: true,
          barcode: true,
          price: true,
          status: true
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'sales-list-items') : [];

    // Group items by saleId
    const itemsBySale = new Map();
    for (const item of items) {
      if (!itemsBySale.has(item.saleId)) {
        itemsBySale.set(item.saleId, []);
      }
      itemsBySale.get(item.saleId).push(item);
    }

    // Combine sales with their items
    const salesWithItems = rows.map(sale => ({
      ...sale,
      items: itemsBySale.get(sale.id) || []
    }));

    logRouteComplete('sales-list', salesWithItems.length);
    return NextResponse.json({ rows: salesWithItems, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch sales", error), 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart('sales-create');

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
      const created = await withRetry(async () => {
        return prisma.$transaction(async (tx) => {
          // Validate inventory availability, status READY and location match
          const upperBarcodes = items.map((b) => String(b).toUpperCase());
          const invItems = await tx.inventory.findMany({
            where: {
              barcode: { in: upperBarcodes },
              status: "READY",
              location,
            },
            select: {
              id: true,
              barcode: true,
              productId: true,
              product: {
                select: {
                  id: true,
                  price: true
                }
              }
            }
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
            select: {
              id: true,
              outlet: true,
              customer: true,
              status: true,
              orderDate: true,
              shipDate: true,
              estPayout: true,
              actPayout: true,
              location: true,
              discount: true,
              actualReceived: true,
              createdAt: true
            }
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

          // Get sale items for response
          const saleItems = await tx.saleItem.findMany({
            where: { saleId: sale.id },
            select: {
              id: true,
              saleId: true,
              productId: true,
              barcode: true,
              price: true,
              status: true
            }
          });

          return { ...sale, items: saleItems };
        });
      }, 2, 'sales-create-with-items');
      
      logRouteComplete('sales-create', 1);
      return NextResponse.json(created, { status: 201 });
    }

    // Otherwise, create header only (no stock changes yet)
    const headerOnly = await withRetry(async () => {
      return prisma.sale.create({
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
        select: {
          id: true,
          outlet: true,
          customer: true,
          status: true,
          orderDate: true,
          shipDate: true,
          estPayout: true,
          actPayout: true,
          location: true,
          discount: true,
          actualReceived: true,
          createdAt: true
        }
      });
    }, 2, 'sales-create-header-only');

    logRouteComplete('sales-create', 1);
    return NextResponse.json({ ...headerOnly, items: [] }, { status: 201 });
  } catch (e: any) {
    if (e?.message === "SOME_BARCODES_NOT_READY_OR_WRONG_LOCATION") {
      return NextResponse.json({ error: "Some barcodes are not READY at the specified location" }, { status: 409 });
    }
    return NextResponse.json(
      createErrorResponse("create sale", e), 
      { status: 500 }
    );
  }
}


