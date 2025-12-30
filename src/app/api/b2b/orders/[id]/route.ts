import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../../lib/db-utils";

const ORDER_SELECT = {
  id: true,
  outlet: true,
  customer: true,
  status: true,
  orderDate: true,
  location: true,
  discount: true,
  totalAmount: true,
  actPayout: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      retailProductId: true,
      productSource: true,
      quantity: true,
      price: true,
      product: { select: { id: true, code: true, name: true, price: true } },
      retailProduct: { select: { id: true, code: true, name: true, price: true } },
    },
  },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    logRouteStart("b2b-orders-get", { id });
    const order = await withRetry(async () => {
      return prisma.orderB2B.findUnique({ where: { id }, select: ORDER_SELECT });
    }, 2, "b2b-orders-get");
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    logRouteComplete("b2b-orders-get", 1);
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(createErrorResponse("fetch b2b order", error), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    logRouteStart("b2b-orders-update", { id });
    const body = await req.json();
    const { outlet, customer, status, orderDate, location, discount, actPayout, items } = body as any;
    if (!outlet || !location || !orderDate) return NextResponse.json({ error: "outlet, location, orderDate required" }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: "at least one item is required" }, { status: 400 });
    const allowed = ["Wholesale", "Cafe"];
    if (!allowed.includes(outlet)) return NextResponse.json({ error: "Outlet must be Wholesale or Cafe" }, { status: 400 });

    const normalizedItems: Array<{
      productId: number;
      quantity: number;
      source: "B2B" | "Retail";
      barcodes?: string[];
    }> = [];

    for (const raw of items as any[]) {
      const src: "B2B" | "Retail" = (String(raw.productSource || raw.source || "B2B").toUpperCase() === "RETAIL") ? "Retail" : "B2B";
      const qty = Math.max(1, Number(raw.quantity) || 1);
      const pid = Number(raw.productId);
      if (src === "Retail") {
        const rawCodes = Array.isArray(raw.barcodes)
          ? raw.barcodes
          : typeof raw.barcode === "string"
            ? [raw.barcode]
            : [];
        const codes = rawCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
        if (codes.length !== qty) {
          return NextResponse.json({ error: `Barcode count must equal quantity (${qty}) for retail items` }, { status: 400 });
        }
        for (const code of codes) {
          normalizedItems.push({ productId: pid, quantity: 1, source: src, barcodes: [code] });
        }
      } else {
        normalizedItems.push({ productId: pid, quantity: qty, source: src });
      }
    }

    const b2bIds = normalizedItems.filter((i) => i.source === "B2B").map((i) => i.productId);
    const retailIds = normalizedItems.filter((i) => i.source === "Retail").map((i) => i.productId);
    const retailBarcodes = normalizedItems
      .filter((i) => i.source === "Retail" && i.barcodes?.length)
      .flatMap((i) => i.barcodes!);

    const [b2bProducts, retailProducts] = await Promise.all([
      b2bIds.length
        ? withRetry(async () =>
            prisma.productB2B.findMany({
              where: { id: { in: b2bIds } },
              select: { id: true, price: true, name: true },
            }),
          , 2, "b2b-orders-update-products-b2b")
        : Promise.resolve([]),
      retailIds.length
        ? withRetry(async () =>
            prisma.product.findMany({
              where: { id: { in: retailIds } },
              select: { id: true, price: true, name: true, code: true },
            }),
          , 2, "b2b-orders-update-products-retail")
        : Promise.resolve([]),
      retailBarcodes.length
        ? withRetry(async () =>
            prisma.inventory.findMany({
              where: { barcode: { in: retailBarcodes }, status: "READY", location },
              select: { id: true, barcode: true, productId: true, location: true },
            }),
          , 2, "b2b-orders-update-products-retail-inventory")
        : Promise.resolve([]),
    ]);

    const b2bMap = new Map(b2bProducts.map((p) => [p.id, p]));
    const retailMap = new Map(retailProducts.map((p) => [p.id, p]));
    const inventoryMap = new Map(retailInventory.map((inv) => [inv.barcode, inv]));

    for (const it of normalizedItems) {
      if (it.source === "B2B" && !b2bMap.has(it.productId)) {
        return NextResponse.json({ error: `Product B2B ${it.productId} not found` }, { status: 400 });
      }
      if (it.source === "Retail" && !retailMap.has(it.productId)) {
        return NextResponse.json({ error: `Product retail ${it.productId} not found` }, { status: 400 });
      }
      if (it.source === "Retail") {
        const code = it.barcodes?.[0];
        if (!code) {
          return NextResponse.json({ error: "Barcode wajib diisi untuk produk retail" }, { status: 400 });
        }
        const inv = inventoryMap.get(code);
        if (!inv) {
          return NextResponse.json({ error: `Barcode ${code} tidak READY di lokasi ${location}` }, { status: 400 });
        }
        if (inv.productId !== it.productId) {
          return NextResponse.json({ error: `Barcode ${code} bukan untuk produk yang dipilih` }, { status: 400 });
        }
      }
    }

    const subtotal = normalizedItems.reduce((acc, it) => {
      const price = it.source === "B2B" ? b2bMap.get(it.productId)!.price : retailMap.get(it.productId)!.price;
      return acc + price * it.quantity;
    }, 0);
    const totalAfterDisc = discount ? Math.round(subtotal * (1 - discount / 100)) : subtotal;

    const updated = await withRetry(
      async () =>
        prisma.$transaction(async (tx) => {
          // restore inventory for previous retail barcodes
          const existing = await tx.orderB2BItem.findMany({ where: { orderId: id, barcode: { not: null } }, select: { barcode: true } });
          for (const it of existing) {
            if (it.barcode) {
              await tx.inventory.updateMany({ where: { barcode: it.barcode }, data: { status: "READY" } });
            }
          }

          await tx.orderB2BItem.deleteMany({ where: { orderId: id } });
          const order = await tx.orderB2B.update({
            where: { id },
            data: {
              outlet,
              customer: customer || null,
              status: status || "PAID",
              orderDate: new Date(orderDate),
              location,
              discount: typeof discount === "number" ? discount : null,
              totalAmount: totalAfterDisc,
              actPayout: actPayout ?? null,
            },
            select: ORDER_SELECT,
          });
          const orderItems = await Promise.all(
            normalizedItems.map((it) =>
              tx.orderB2BItem.create({
                data: {
                  orderId: order.id,
                  productId: it.source === "B2B" ? it.productId : null,
                  retailProductId: it.source === "Retail" ? it.productId : null,
                  productSource: it.source,
                  barcode: it.source === "Retail" ? it.barcodes?.[0] ?? null : null,
                  quantity: it.quantity,
                  price: it.source === "B2B" ? b2bMap.get(it.productId)!.price : retailMap.get(it.productId)!.price,
                },
                select: ORDER_SELECT.items.select,
              }),
            ),
          );
          for (const it of normalizedItems) {
            if (it.source === "Retail" && it.barcodes?.length) {
              for (const code of it.barcodes) {
                await tx.inventory.update({
                  where: { barcode: code },
                  data: { status: "SOLD" },
                });
              }
            }
          }
          return { ...order, items: orderItems };
        }),
      2,
      "b2b-orders-update",
    );
    logRouteComplete("b2b-orders-update", 1);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(createErrorResponse("update b2b order", error), { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    logRouteStart("b2b-orders-delete", { id });
    await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.orderB2BItem.findMany({ where: { orderId: id, barcode: { not: null } }, select: { barcode: true } });
        for (const it of existing) {
          if (it.barcode) {
            await tx.inventory.updateMany({ where: { barcode: it.barcode }, data: { status: "READY" } });
          }
        }
        await tx.orderB2BItem.deleteMany({ where: { orderId: id } });
        await tx.orderB2B.delete({ where: { id } });
      });
    }, 2, "b2b-orders-delete");
    logRouteComplete("b2b-orders-delete", 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("delete b2b order", error), { status: 500 });
  }
}
