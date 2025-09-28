import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    
    logRouteStart('sales-get', { id });
    
    const sale = await withRetry(async () => {
      return prisma.sale.findUnique({ where: { id }, include: { items: true } });
    }, 2, 'sales-get');
    
    if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    logRouteComplete('sales-get');
    return NextResponse.json(sale);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch sale", error), 
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    
    logRouteStart('sales-update', { id });
    const body = await req.json();
    const data: any = {};
    for (const key of [
      "outlet",
      "customer",
      "status",
      "location",
    ] as const) {
      if (key in body) data[key] = body[key];
    }
    if ("orderDate" in body) data.orderDate = body.orderDate ? new Date(body.orderDate) : undefined;
    if ("shipDate" in body) data.shipDate = body.shipDate ? new Date(body.shipDate) : null;
    if ("estPayout" in body) data.estPayout = typeof body.estPayout === "number" ? body.estPayout : null;
    if ("actPayout" in body) data.actPayout = typeof body.actPayout === "number" ? body.actPayout : null;
    if ("discount" in body) data.discount = typeof body.discount === "number" ? body.discount : null;
    if ("actualReceived" in body) data.actualReceived = typeof body.actualReceived === "number" ? body.actualReceived : null;

    const updated = await withRetry(async () => {
      return prisma.sale.update({ where: { id }, data, include: { items: true } });
    }, 2, 'sales-update');
    
    logRouteComplete('sales-update');
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      createErrorResponse("update sale", error), 
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    
    logRouteStart('sales-delete', { id });
    
    await withRetry(async () => {
      return prisma.$transaction([
        prisma.saleItem.deleteMany({ where: { saleId: id } }),
        prisma.sale.delete({ where: { id } }),
      ]);
    }, 2, 'sales-delete');
    
    logRouteComplete('sales-delete');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      createErrorResponse("delete sale", error), 
      { status: 500 }
    );
  }
}


