import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const sale = await prisma.sale.findUnique({ where: { id }, include: { items: true } });
    if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(sale);
  } catch {
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
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

    const updated = await prisma.sale.update({ where: { id }, data, include: { items: true } });
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await prisma.$transaction([
      prisma.saleItem.deleteMany({ where: { saleId: id } }),
      prisma.sale.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}


