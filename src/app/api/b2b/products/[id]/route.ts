import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../../lib/db-utils";

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    logRouteStart("b2b-products-update", { id });
    const body = await _req.json();
    const { name, price, hppPct } = body as { name?: string; price?: number; hppPct?: number | null };
    const pct = typeof hppPct === "number" ? hppPct : null;
    const hppValue = typeof price === "number" && pct != null ? Math.round(price * pct) : undefined;

    const updated = await withRetry(async () => {
      return prisma.productB2B.update({
        where: { id },
        data: {
          name: name ?? undefined,
          price: typeof price === "number" ? price : undefined,
          hppPct: pct,
          hppValue,
        },
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          hppPct: true,
          hppValue: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }, 2, "b2b-products-update");
    logRouteComplete("b2b-products-update", 1);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(createErrorResponse("update b2b product", error), { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    logRouteStart("b2b-products-delete", { id });
    await withRetry(async () => prisma.productB2B.delete({ where: { id } }), 2, "b2b-products-delete");
    logRouteComplete("b2b-products-delete", 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("delete b2b product", error), { status: 500 });
  }
}
